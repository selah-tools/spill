#!/usr/bin/env python3
"""Remove legacy `views` counters from Spill's production Upstash Redis.

Defaults:
- loads KV URL + write token from Proton Pass item titles used in this repo
- removes `views` field from all `prompt:*` hashes

Optional:
- pass --delete-events-list to also delete `events:recent`
- pass --wipe-all to delete every `prompt:*` feedback hash and `events:recent`

Env overrides:
- KV_REST_API_URL
- KV_REST_API_TOKEN
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from typing import Iterable
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


def kv_json(url: str, token: str, path: str | None = None, body: list[str | int] | None = None) -> dict:
    target = url if path is None else f"{url.rstrip('/')}/{path.lstrip('/')}"
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json',
    }
    data = None if body is None else json.dumps(body).encode()
    req = Request(target, data=data, headers=headers, method='POST' if body is not None else 'GET')
    with urlopen(req) as res:
        return json.loads(res.read().decode())


def scan_prompt_keys(url: str, token: str) -> list[str]:
    keys: list[str] = []
    cursor = '0'
    while True:
        out = kv_json(url, token, body=['SCAN', cursor, 'MATCH', 'prompt:*', 'COUNT', '200'])
        cursor, batch = out['result']
        keys.extend(batch)
        if cursor == '0':
            break
    return keys


def hash_to_dict(arr: list[str]) -> dict[str, str]:
    return dict(zip(arr[::2], arr[1::2]))


def main(argv: list[str]) -> int:
    wipe_all = '--wipe-all' in argv
    delete_events = '--delete-events-list' in argv or wipe_all
    dry_run = '--dry-run' in argv

    url, token = get_env()
    keys = scan_prompt_keys(url, token)
    keys_with_views: list[tuple[str, str]] = []

    for key in keys:
        out = kv_json(url, token, path=f'hgetall/{key}')
        result = out.get('result', [])
        data = hash_to_dict(result) if isinstance(result, list) else {}
        if 'views' in data:
            keys_with_views.append((key, data['views']))

    print(json.dumps({
        'prompt_keys': len(keys),
        'keys_with_views': len(keys_with_views),
        'delete_events_list': delete_events,
        'wipe_all': wipe_all,
        'dry_run': dry_run,
        'sample': keys_with_views[:10],
    }, indent=2))

    if dry_run:
        return 0

    if wipe_all:
        deleted_prompt_keys = 0
        for key in keys:
            deleted_prompt_keys += int(kv_json(url, token, body=['DEL', key]).get('result', 0))
        deleted_events = kv_json(url, token, body=['DEL', 'events:recent']).get('result') if delete_events else None
        remaining_keys = scan_prompt_keys(url, token)
        events_exists = kv_json(url, token, body=['EXISTS', 'events:recent']).get('result')
        print(json.dumps({
            'deleted_prompt_keys': deleted_prompt_keys,
            'deleted_events_result': deleted_events,
            'remaining_prompt_keys': len(remaining_keys),
            'events_exists': events_exists,
        }, indent=2))
        return 0 if not remaining_keys and not events_exists else 1

    for key, _views in keys_with_views:
        kv_json(url, token, body=['HDEL', key, 'views'])

    deleted_events = None
    if delete_events:
        deleted_events = kv_json(url, token, body=['DEL', 'events:recent']).get('result')

    remaining = []
    for key, _views in keys_with_views:
        out = kv_json(url, token, path=f'hgetall/{key}')
        result = out.get('result', [])
        data = hash_to_dict(result) if isinstance(result, list) else {}
        if 'views' in data:
            remaining.append(key)

    print(json.dumps({
        'removed_view_fields': len(keys_with_views) - len(remaining),
        'remaining_with_views': remaining,
        'deleted_events_result': deleted_events,
    }, indent=2))
    return 0 if not remaining else 1


if __name__ == '__main__':
    raise SystemExit(main(sys.argv[1:]))
