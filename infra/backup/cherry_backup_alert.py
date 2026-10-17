#!/usr/bin/python3
"""Send a minimal operator alert using the existing Telegram alert channel."""

import json
from pathlib import Path
import re
import sys
import urllib.request


def main():
    unit = sys.argv[1]
    if not re.fullmatch(r"[A-Za-z0-9@_.-]{1,100}", unit):
        raise ValueError("invalid unit")
    path = Path("/etc/cherry-backup/alerts.json")
    if path.stat().st_mode & 0o077:
        raise ValueError("unsafe secret permissions")
    config = json.loads(path.read_text())
    if not config.get("bot_token") or not config.get("chat_id"):
        raise ValueError("missing alert credentials")
    body = json.dumps(
        {
            "chat_id": config["chat_id"],
            "text": f"Cherry: fallo en {unit}. Revisar backup, retención y registro de bajas en cherry-db. No se incluyen datos personales en este aviso.",
            "disable_web_page_preview": True,
        }
    ).encode()
    request = urllib.request.Request(
        "https://api.telegram.org/bot" + config["bot_token"] + "/sendMessage",
        data=body,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        if not json.load(response).get("ok"):
            raise RuntimeError("alert rejected")


if __name__ == "__main__":
    try:
        main()
    except Exception:
        print(
            "Cherry backup alert could not be delivered; inspect privately.",
            file=sys.stderr,
        )
        sys.exit(1)
