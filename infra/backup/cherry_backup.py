#!/usr/bin/python3
"""Cherry: independent encrypted pg_dump backups, seven-day retention, safe journal GC.

Requires Debian packages age and python3-boto3. Config and recovery keys never
belong in the repository. Only ciphertext is written to the temporary directory.
"""

import argparse
import datetime as dt
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import uuid

UTC = dt.timezone.utc
RETENTION = dt.timedelta(days=7)
KEY_RE = re.compile(r"^daily/(\d{8}T\d{6}Z)_[a-f0-9]{32}\.dump\.age$")
EVENT_RE = re.compile(
    r"^v1/requests/(account|photo|storage|provider)/([a-f0-9-]+)\.json$"
)


def stamp(value):
    return value.astimezone(UTC).strftime("%Y%m%dT%H%M%SZ")


def snapshot_time(key):
    match = KEY_RE.fullmatch(key)
    if not match:
        raise RuntimeError("unrecognized backup object; refuse retention/GC")
    return dt.datetime.strptime(match[1], "%Y%m%dT%H%M%SZ").replace(tzinfo=UTC)


def iso(value):
    return dt.datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(UTC)


def s3(config):
    import boto3
    from botocore.config import Config

    required = ("endpoint", "bucket", "access_key_id", "secret_access_key")
    if not all(config.get(k) for k in required):
        raise RuntimeError("incomplete bucket credentials")
    return boto3.client(
        "s3",
        endpoint_url=config["endpoint"],
        region_name="auto",
        aws_access_key_id=config["access_key_id"],
        aws_secret_access_key=config["secret_access_key"],
        config=Config(
            signature_version="s3v4",
            retries={"max_attempts": 2},
            connect_timeout=10,
            read_timeout=60,
            request_checksum_calculation="when_required",
            response_checksum_validation="when_required",
        ),
    )


def objects(client, bucket, prefix=""):
    return [
        item
        for page in client.get_paginator("list_objects_v2").paginate(
            Bucket=bucket, Prefix=prefix
        )
        for item in page.get("Contents", [])
    ]


def missing(client, bucket, key):
    from botocore.exceptions import ClientError

    try:
        client.head_object(Bucket=bucket, Key=key)
        return False
    except ClientError as error:
        if error.response["ResponseMetadata"]["HTTPStatusCode"] == 404:
            return True
        raise


def delete_verified(client, bucket, key):
    client.delete_object(Bucket=bucket, Key=key)
    if not missing(client, bucket, key):
        raise RuntimeError("object deletion was not confirmed")


def prune(client, bucket, now):
    deleted = 0
    for obj in objects(client, bucket):
        created = snapshot_time(obj["Key"])
        if created > now + dt.timedelta(minutes=5):
            raise RuntimeError("future-dated backup; check clock")
        if created <= now - RETENTION:
            delete_verified(client, bucket, obj["Key"])
            deleted += 1
    remaining = objects(client, bucket)
    if any(snapshot_time(obj["Key"]) <= now - RETENTION for obj in remaining):
        raise RuntimeError("expired backup survived cleanup")
    return remaining, deleted


def abort_stale_uploads(client, bucket, now):
    # Our backup objects use single PUTs, but clean up an interrupted external
    # multipart attempt too. Lifecycle is an independent one-day safety net.
    result = client.list_multipart_uploads(Bucket=bucket)
    while True:
        for upload in result.get("Uploads", []):
            if upload["Initiated"] <= now - dt.timedelta(days=1):
                client.abort_multipart_upload(
                    Bucket=bucket, Key=upload["Key"], UploadId=upload["UploadId"]
                )
        if not result.get("IsTruncated"):
            break
        result = client.list_multipart_uploads(
            Bucket=bucket,
            KeyMarker=result["NextKeyMarker"],
            UploadIdMarker=result["NextUploadIdMarker"],
        )


def digest_file(path):
    digest = hashlib.sha256()
    with open(path, "rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def verify_object(client, bucket, key, expected_hash, expected_size):
    response = client.get_object(Bucket=bucket, Key=key)
    digest = hashlib.sha256()
    size = 0
    try:
        for chunk in response["Body"].iter_chunks(1024 * 1024):
            digest.update(chunk)
            size += len(chunk)
    finally:
        response["Body"].close()
    if size != expected_size or digest.hexdigest() != expected_hash:
        raise RuntimeError("uploaded ciphertext failed round-trip verification")


def pg(config, sql):
    result = subprocess.run(
        [
            "sudo",
            "-n",
            "-u",
            "postgres",
            "psql",
            "-XAt",
            "--set",
            "ON_ERROR_STOP=1",
            "--dbname",
            config["database"],
        ],
        input=sql,
        text=True,
        capture_output=True,
        timeout=60,
        check=False,
    )
    if result.returncode:
        raise RuntimeError("live database check failed")
    return result.stdout.strip()


def event_applied(config, event):
    kind, ref = event["kind"], event["reference"]
    if kind in ("account", "photo"):
        uuid.UUID(ref)
    # Never expose values in process arguments or logs. Only fixed SQL grammar
    # plus an escaped literal, sent over stdin to the local peer-authenticated DB.
    literal = "'" + ref.replace("'", "''") + "'"
    if kind == "account":
        sql = f"SELECT NOT EXISTS(SELECT 1 FROM users WHERE id={literal}::uuid);"
    elif kind == "photo":
        sql = f"SELECT NOT EXISTS(SELECT 1 FROM profile_photos WHERE id={literal}::uuid AND is_active);"
    elif kind in ("storage", "provider"):
        sql = f"SELECT NOT EXISTS(SELECT 1 FROM erasure_tasks WHERE kind='{kind}' AND reference={literal});"
    else:
        raise RuntimeError("invalid journal event kind")
    return pg(config, sql) == "t"


def journal_gc(config, backups, now):
    if not config.get("journal_gc_enabled"):
        return 0
    jc = config["journal"]
    client = s3(jc)
    bucket = jc["bucket"]
    # No blind event TTL: a confirmed completion must precede EVERY surviving
    # snapshot. If copies stop, retain events seven days after completion, then
    # prune only once no unsafe backup survives and the live DB agrees.
    oldest = min((snapshot_time(b["Key"]) for b in backups), default=now - RETENTION)
    deleted = 0
    for obj in objects(client, bucket, "v1/requests/"):
        key = obj["Key"]
        if not EVENT_RE.fullmatch(key):
            raise RuntimeError("unexpected journal key; GC stopped")
        ack = key.replace("v1/requests/", "v1/applied/", 1)
        if missing(client, bucket, ack):
            continue
        ack_obj = client.get_object(Bucket=bucket, Key=ack)
        completed = iso(json.loads(ack_obj["Body"].read())["completed_at"])
        if completed >= oldest or completed >= now - RETENTION:
            continue
        event_obj = client.get_object(Bucket=bucket, Key=key)
        event = json.loads(event_obj["Body"].read())
        if not event_applied(config, event):
            continue
        delete_verified(client, bucket, key)
        delete_verified(client, bucket, ack)
        deleted += 1
    # Recover a crash between removing the request and its acknowledgement.
    for obj in objects(client, bucket, "v1/applied/"):
        request_key = obj["Key"].replace("v1/applied/", "v1/requests/", 1)
        if missing(client, bucket, request_key):
            delete_verified(client, bucket, obj["Key"])
    return deleted


def journal_status(config, now):
    jc = config["journal"]
    client = s3(jc)
    overdue = 0
    for obj in objects(client, jc["bucket"], "v1/requests/"):
        key = obj["Key"]
        if not EVENT_RE.fullmatch(key):
            raise RuntimeError("unexpected recovery event")
        ack = key.replace("v1/requests/", "v1/applied/", 1)
        if missing(client, jc["bucket"], ack):
            response = client.get_object(Bucket=jc["bucket"], Key=key)
            event = json.loads(response["Body"].read())
            deadline = max(iso(event["requested_at"]), iso(event["finalize_after"]))
            if now - deadline > dt.timedelta(minutes=30):
                overdue += 1
    return overdue


def backup(config, client, now):
    if not config.get("age_recipient", "").startswith("age1"):
        raise RuntimeError("missing age public recipient")
    directory = Path(config.get("temporary_directory", "/run/cherry-backup"))
    directory.mkdir(mode=0o700, parents=True, exist_ok=True)
    key = f"daily/{stamp(now)}_{uuid.uuid4().hex}.dump.age"
    with tempfile.TemporaryDirectory(prefix="ciphertext-", dir=directory) as temporary:
        path = Path(temporary) / "database.dump.age"
        dump = subprocess.Popen(
            [
                "sudo",
                "-n",
                "-u",
                "postgres",
                "pg_dump",
                "--format=custom",
                "--no-owner",
                "--no-acl",
                "--dbname",
                config["database"],
            ],
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
        )
        try:
            with open(path, "xb") as output:
                os.chmod(path, 0o600)
                encrypt = subprocess.Popen(
                    ["age", "--encrypt", "--recipient", config["age_recipient"]],
                    stdin=dump.stdout,
                    stdout=output,
                    stderr=subprocess.DEVNULL,
                )
                dump.stdout.close()
                try:
                    encryption_result = encrypt.wait(timeout=3600)
                finally:
                    if encrypt.poll() is None:
                        encrypt.kill()
                        encrypt.wait()
            if dump.wait(timeout=60) or encryption_result:
                raise RuntimeError("pg_dump or age failed; no backup published")
        finally:
            if dump.poll() is None:
                dump.kill()
                dump.wait()
        size = path.stat().st_size
        # Single atomic PUT avoids unfinished multipart ciphertext. Revisit the
        # transfer strategy if the compressed encrypted DB ever exceeds 4 GiB.
        if size <= 100 or size > 4 * 1024**3:
            raise RuntimeError("ciphertext size outside supported limits")
        checksum = digest_file(path)
        with open(path, "rb") as stream:
            client.put_object(
                Bucket=config["backup"]["bucket"],
                Key=key,
                Body=stream,
                ContentLength=size,
                ContentType="application/octet-stream",
                Metadata={"sha256": checksum, "snapshot-start": now.isoformat()},
            )
        verify_object(client, config["backup"]["bucket"], key, checksum, size)
    return {"key": key, "bytes": size, "sha256": checksum}


def download(config, client, key, destination):
    snapshot_time(key)
    head = client.head_object(Bucket=config["backup"]["bucket"], Key=key)
    checksum = head.get("Metadata", {}).get("sha256")
    if not checksum:
        raise RuntimeError("missing ciphertext checksum")
    # Never overwrite a recovery artifact or put plaintext in this path.
    with open(destination, "xb") as output:
        os.chmod(destination, 0o600)
        response = client.get_object(Bucket=config["backup"]["bucket"], Key=key)
        try:
            for chunk in response["Body"].iter_chunks(1024 * 1024):
                output.write(chunk)
        finally:
            response["Body"].close()
    if digest_file(destination) != checksum:
        Path(destination).unlink()
        raise RuntimeError("downloaded ciphertext checksum mismatch")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=("backup", "prune", "status", "download"))
    parser.add_argument("--config", default="/etc/cherry-backup/config.json")
    parser.add_argument("--key")
    parser.add_argument("--output")
    args = parser.parse_args()
    os.umask(0o077)
    config_path = Path(args.config)
    if config_path.stat().st_mode & 0o077:
        raise RuntimeError("config must have permissions 0600")
    config = json.loads(config_path.read_text())
    client = s3(config["backup"])
    now = dt.datetime.now(UTC)
    if args.command == "download":
        if not args.key or not args.output:
            parser.error("download requires --key and --output (ciphertext only)")
        download(config, client, args.key, args.output)
        print("Ciphertext downloaded and verified.")
        return
    lock_path = config.get("lock_file", "/run/lock/cherry-backup.lock")
    with open(lock_path, "w") as lock:
        try:
            fcntl.flock(
                lock, fcntl.LOCK_EX | (fcntl.LOCK_NB if args.command == "prune" else 0)
            )
        except BlockingIOError:
            print(
                "Retention skipped while the backup lock is held; retry at next timer."
            )
            return
        if args.command == "status":
            entries = objects(client, config["backup"]["bucket"])
            times = [snapshot_time(b["Key"]) for b in entries]
            fresh = bool(times) and now - max(times) < dt.timedelta(hours=26)
            unexpired = all(t > now - RETENTION for t in times)
            overdue = journal_status(config, now)
            print(
                json.dumps(
                    {
                        "backups": len(entries),
                        "fresh": fresh,
                        "unexpired": unexpired,
                        "latest": max(times).isoformat() if times else None,
                        "overdue_erasures": overdue,
                    }
                )
            )
            if not (fresh and unexpired and overdue == 0):
                raise RuntimeError("backup missing, stale, or expired")
            return
        remaining, deleted = prune(client, config["backup"]["bucket"], now)
        abort_stale_uploads(client, config["backup"]["bucket"], now)
        result = backup(config, client, now) if args.command == "backup" else {}
        # Refresh inventory after publishing. Failure must never retain an old
        # 'last good backup' indefinitely; prune is its own frequent timer too.
        remaining, extra = prune(
            client, config["backup"]["bucket"], dt.datetime.now(UTC)
        )
        gc = journal_gc(config, remaining, now)
        print(
            json.dumps(
                {
                    "result": "ok",
                    "expired_deleted": deleted + extra,
                    "journal_deleted": gc,
                    **result,
                }
            )
        )


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        # SDK errors may include credentials, signed URLs or object references.
        # Keep logs deliberately generic; diagnose using scoped status commands.
        print(
            f"Cherry backup operation failed ({type(error).__name__}); inspect service/config privately.",
            file=sys.stderr,
        )
        sys.exit(1)
