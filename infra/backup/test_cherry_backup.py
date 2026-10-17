import datetime as dt
import io
import unittest
from unittest.mock import patch
import cherry_backup as backup


class FakeS3:
    def __init__(self, keys):
        self.keys = set(keys)
        self.deleted = []
        self.retain = False

    def get_paginator(self, name):
        return self

    def paginate(self, **kwargs):
        yield {"Contents": [{"Key": key} for key in self.keys]}

    def delete_object(self, **kwargs):
        self.deleted.append(kwargs["Key"])
        if not self.retain:
            self.keys.discard(kwargs["Key"])


def key(now):
    return f"daily/{backup.stamp(now)}_{'a' * 32}.dump.age"


class BackupTest(unittest.TestCase):
    def setUp(self):
        self.now = dt.datetime(2026, 10, 17, 12, tzinfo=backup.UTC)

    def test_retention_uses_content_time_even_when_a_new_copy_failed(self):
        expired = key(self.now - dt.timedelta(days=7))
        recent = key(self.now - dt.timedelta(days=6, hours=23))
        client = FakeS3([expired, recent])
        with patch.object(
            backup, "missing", side_effect=lambda c, b, k: k not in c.keys
        ):
            remaining, count = backup.prune(client, "bucket", self.now)
        self.assertEqual(count, 1)
        self.assertEqual([x["Key"] for x in remaining], [recent])

    def test_last_good_backup_is_not_retained_forever(self):
        client = FakeS3([key(self.now - dt.timedelta(days=8))])
        with patch.object(
            backup, "missing", side_effect=lambda c, b, k: k not in c.keys
        ):
            remaining, _ = backup.prune(client, "bucket", self.now)
        self.assertEqual(remaining, [])

    def test_a_failed_delete_is_not_reported_as_success(self):
        client = FakeS3([key(self.now - dt.timedelta(days=8))])
        client.retain = True
        with patch.object(backup, "missing", return_value=False):
            with self.assertRaises(RuntimeError):
                backup.prune(client, "bucket", self.now)

    def test_unrecognized_or_future_backups_stop_gc(self):
        for name in ("unexpected.sql", key(self.now + dt.timedelta(hours=1))):
            with self.assertRaises(RuntimeError):
                backup.prune(FakeS3([name]), "bucket", self.now)

    def test_ciphertext_round_trip_verifies_bytes_not_just_metadata(self):
        client = unittest.mock.Mock()
        body = unittest.mock.Mock()
        body.iter_chunks.return_value = iter([b"cipher", b"text"])
        client.get_object.return_value = {"Body": body}
        good = backup.hashlib.sha256(b"ciphertext").hexdigest()
        backup.verify_object(client, "bucket", "key", good, 10)
        body.iter_chunks.return_value = iter([b"corrupted!"])
        with self.assertRaises(RuntimeError):
            backup.verify_object(client, "bucket", "key", good, 10)

    def test_journal_gc_needs_completion_older_than_all_snapshots_and_live_absence(
        self,
    ):
        request_key = "v1/requests/account/00000000-0000-0000-0000-000000000001.json"
        ack_key = request_key.replace("requests", "applied")
        client = unittest.mock.Mock()
        event = {"kind": "account", "reference": "00000000-0000-0000-0000-000000000001"}

        def get_object(**kwargs):
            value = (
                {"completed_at": (self.now - dt.timedelta(days=8)).isoformat()}
                if kwargs["Key"] == ack_key
                else event
            )
            return {"Body": io.BytesIO(backup.json.dumps(value).encode())}

        client.get_object.side_effect = get_object
        config = {"journal_gc_enabled": True, "journal": {"bucket": "journal"}}
        with (
            patch.object(backup, "s3", return_value=client),
            patch.object(
                backup,
                "objects",
                side_effect=lambda c, b, p: (
                    [{"Key": request_key}] if p == "v1/requests/" else []
                ),
            ),
            patch.object(backup, "missing", return_value=False),
            patch.object(backup, "delete_verified") as delete,
            patch.object(backup, "event_applied", return_value=False),
        ):
            self.assertEqual(backup.journal_gc(config, [], self.now), 0)
            delete.assert_not_called()
        with (
            patch.object(backup, "s3", return_value=client),
            patch.object(
                backup,
                "objects",
                side_effect=lambda c, b, p: (
                    [{"Key": request_key}] if p == "v1/requests/" else []
                ),
            ),
            patch.object(backup, "missing", return_value=False),
            patch.object(backup, "delete_verified") as delete,
            patch.object(backup, "event_applied", return_value=True),
        ):
            self.assertEqual(
                backup.journal_gc(
                    config, [{"Key": key(self.now - dt.timedelta(days=9))}], self.now
                ),
                0,
            )
            self.assertEqual(
                backup.journal_gc(
                    config, [{"Key": key(self.now - dt.timedelta(days=6))}], self.now
                ),
                1,
            )
            self.assertEqual(delete.call_count, 2)


if __name__ == "__main__":
    unittest.main()
