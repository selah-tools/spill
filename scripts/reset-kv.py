#!/usr/bin/env python3
"""Reset Spill's Upstash KV database by deleting all keys.

Defaults:
- loads KV URL + write token from Proton Pass item titles used in this repo
- scans the full keyspace and deletes every key it finds

Optional:
- pass --dry-run to list keys without deleting them

Env overrides:
- KV_REST_API_URL
- KV_REST_API_TOKEN
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from urllib.request import Request, urlopen


def pass_value(title: str) -> str:
    return subprocess.check_output(
        [
            'pass-cli',
            'item',
            'view',
            '--vault-name',
            'Agent Secrets',
            '--item-title',
            title,
            '--field',
            'password',
        ],
        text=True,
    ).strip()


def get_env() -> tuple[str, str]:
    url = os.environ.get('KV_REST_API_URL') or pass_value('feedback_KV_REST_API_URL')
    token = os.environ.get('KV_REST_API_TOKEN') or pass_value('feedback_KV_REST_API_TOKEN')
    return url, token


def kv_json(
    url: str,
    token: str,
    body: list[str | int],
) -> dict:
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json',
    }
    req = Request(
        url,
        data=json.dumps(body).encode(),
        headers=headers,
        method='POST',
    )
    with urlopen(req) as res:
        return json.loads(res.read().decode())


def scan_all_keys(url: str, token: str) -> list[str]:
    keys: list[str] = []
    cursor = '0'
    while True:
        out = kv_json(url, token, ['SCAN', cursor, 'MATCH', '*', 'COUNT', '200'])
        cursor, batch = out['result']
        keys.extend(batch)
        if cursor == '0':
            break
    return sorted(set(keys))


def main(argv: list[str]) -> int:
    dry_run = '--dry-run' in argv
    url, token = get_env()

    keys = scan_all_keys(url, token)
    print(json.dumps({
        'dry_run': dry_run,
        'key_count': len(keys),
        'keys': keys,
    }, indent=2))

    if dry_run:
        return 0

    deleted = 0
    for key in keys:
        deleted += int(kv_json(url, token, ['DEL', key]).get('result', 0))

    remaining = scan_all_keys(url, token)
    print(json.dumps({
        'deleted': deleted,
        'remaining_count': len(remaining),
        'remaining_keys': remaining,
    }, indent=2))

    return 0 if not remaining else 1


if __name__ == '__main__':
    raise SystemExit(main(sys.argv[1:]))
