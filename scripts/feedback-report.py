#!/usr/bin/env python3
"""Aggregate Spill prod thumbs up/down feedback from Upstash Redis.

One-file report for the common questions:
- favorites (most upvotes)
- least favorites (most downvotes)
- best / worst upvote ratio with minimum sample size
- most polarizing prompts
- unrated prompts
- rollups by audience, depth, category, and mode

Defaults:
- loads Redis REST URL + read-only token from Proton Pass
- loads prompt metadata from deployed /api/prompt-map

Env overrides:
- KV_REST_API_URL
- KV_REST_API_READ_ONLY_TOKEN
- PROMPT_MAP_URL

Examples:
  python3 scripts/feedback-report.py
  python3 scripts/feedback-report.py --limit 15 --min-ratings 3
  python3 scripts/feedback-report.py --json
  python3 scripts/feedback-report.py --cid friends-light-01-uy966a
"""

from __future__ import annotations

import argparse
import json
import math
import os
import subprocess
import sys
from collections import defaultdict
from dataclasses import dataclass, asdict
from typing import Any, Iterable
from urllib.request import Request, urlopen

DEFAULT_PROMPT_MAP_URL = 'https://www.spill.cards/api/prompt-map'
READ_ONLY_TOKEN_TITLE = 'feedback_KV_REST_API_READ_ONLY_TOKEN'
KV_URL_TITLE = 'feedback_KV_REST_API_URL'


@dataclass
class PromptStats:
    cid: str
    id: str | None
    text: str | None
    audience: list[str]
    depth: str | None
    mode: str | None
    category: str | None
    upvotes: int
    downvotes: int

    @property
    def ratings(self) -> int:
        return self.upvotes + self.downvotes

    @property
    def score(self) -> int:
        return self.upvotes - self.downvotes

    @property
    def upvote_ratio(self) -> float | None:
        if self.ratings == 0:
            return None
        return self.upvotes / self.ratings

    @property
    def polarization(self) -> int:
        return min(self.upvotes, self.downvotes)


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


def get_secrets() -> tuple[str, str]:
    kv_url = os.environ.get('KV_REST_API_URL') or pass_value(KV_URL_TITLE)
    kv_token = os.environ.get('KV_REST_API_READ_ONLY_TOKEN') or pass_value(READ_ONLY_TOKEN_TITLE)
    return kv_url, kv_token


def http_json(url: str, headers: dict[str, str] | None = None, body: Any | None = None) -> dict[str, Any]:
    data = None if body is None else json.dumps(body).encode()
    req = Request(
        url,
        data=data,
        headers=headers or {},
        method='POST' if body is not None else 'GET',
    )
    with urlopen(req) as res:
        return json.loads(res.read().decode())


def kv_get(url: str, token: str, path: str) -> dict[str, Any]:
    return http_json(
        f"{url.rstrip('/')}/{path.lstrip('/')}",
        headers={'Authorization': f'Bearer {token}'},
    )


def kv_cmd(url: str, token: str, command: list[str | int]) -> dict[str, Any]:
    return http_json(
        url,
        headers={
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json',
        },
        body=command,
    )


def scan_prompt_keys(kv_url: str, kv_token: str) -> list[str]:
    keys: list[str] = []
    cursor = '0'
    while True:
        out = kv_cmd(kv_url, kv_token, ['SCAN', cursor, 'MATCH', 'prompt:*', 'COUNT', '200'])
        cursor, batch = out['result']
        keys.extend(batch)
        if cursor == '0':
            break
    return sorted(set(keys))


def hgetall_dict(kv_url: str, kv_token: str, key: str) -> dict[str, str]:
    out = kv_get(kv_url, kv_token, f'hgetall/{key}')
    arr = out.get('result', [])
    if not isinstance(arr, list):
        return {}
    return dict(zip(arr[::2], arr[1::2]))


def load_prompt_map(prompt_map_url: str) -> dict[str, dict[str, Any]]:
    out = http_json(prompt_map_url)
    prompts = out.get('prompts', [])
    return {prompt['cid']: prompt for prompt in prompts}


def prompt_stats_from_store(
    kv_url: str,
    kv_token: str,
    prompt_map: dict[str, dict[str, Any]],
) -> tuple[list[PromptStats], int]:
    keys = scan_prompt_keys(kv_url, kv_token)
    stats: list[PromptStats] = []

    for key in keys:
        cid = key.removeprefix('prompt:')
        fields = hgetall_dict(kv_url, kv_token, key)
        meta = prompt_map.get(cid, {})
        stats.append(
            PromptStats(
                cid=cid,
                id=meta.get('id'),
                text=meta.get('text'),
                audience=list(meta.get('audience', [])),
                depth=meta.get('depth'),
                mode=meta.get('mode'),
                category=meta.get('category'),
                upvotes=int(fields.get('upvotes', 0)),
                downvotes=int(fields.get('downvotes', 0)),
            )
        )

    for cid, meta in prompt_map.items():
        if cid in {s.cid for s in stats}:
            continue
        stats.append(
            PromptStats(
                cid=cid,
                id=meta.get('id'),
                text=meta.get('text'),
                audience=list(meta.get('audience', [])),
                depth=meta.get('depth'),
                mode=meta.get('mode'),
                category=meta.get('category'),
                upvotes=0,
                downvotes=0,
            )
        )

    return stats, len(keys)


def top(items: list[PromptStats], key_fn, limit: int) -> list[PromptStats]:
    return sorted(items, key=key_fn, reverse=True)[:limit]


def bottom(items: list[PromptStats], key_fn, limit: int) -> list[PromptStats]:
    return sorted(items, key=key_fn)[:limit]


def ratio_str(value: float | None) -> str:
    if value is None:
        return '—'
    return f'{value:.0%}'


def truncate(text: str | None, max_len: int = 78) -> str:
    if not text:
        return '—'
    text = ' '.join(text.split())
    if len(text) <= max_len:
        return text
    return text[: max_len - 1] + '…'


def row_dict(p: PromptStats) -> dict[str, Any]:
    return {
        'cid': p.cid,
        'id': p.id,
        'text': p.text,
        'audience': p.audience,
        'depth': p.depth,
        'mode': p.mode,
        'category': p.category,
        'upvotes': p.upvotes,
        'downvotes': p.downvotes,
        'ratings': p.ratings,
        'score': p.score,
        'upvote_ratio': p.upvote_ratio,
        'polarization': p.polarization,
    }


def aggregate_by(items: Iterable[PromptStats], field: str) -> list[dict[str, Any]]:
    bucket: dict[str, dict[str, Any]] = defaultdict(lambda: {
        'key': None,
        'prompts': 0,
        'rated_prompts': 0,
        'upvotes': 0,
        'downvotes': 0,
        'ratings': 0,
        'score': 0,
    })

    for p in items:
        values: list[str]
        if field == 'audience':
            values = p.audience or ['—']
        else:
            values = [getattr(p, field) or '—']

        for value in values:
            b = bucket[value]
            b['key'] = value
            b['prompts'] += 1
            b['upvotes'] += p.upvotes
            b['downvotes'] += p.downvotes
            b['ratings'] += p.ratings
            b['score'] += p.score
            if p.ratings > 0:
                b['rated_prompts'] += 1

    rows = list(bucket.values())
    for row in rows:
        row['upvote_ratio'] = None if row['ratings'] == 0 else row['upvotes'] / row['ratings']
    rows.sort(key=lambda r: (r['score'], r['upvotes'], -r['downvotes']), reverse=True)
    return rows


def print_section(title: str, items: list[PromptStats]) -> None:
    print(f'\n## {title}')
    if not items:
        print('(none)')
        return

    for idx, p in enumerate(items, start=1):
        meta = ' · '.join([x for x in [p.depth, p.mode, p.category] if x]) or '—'
        print(
            f"{idx:>2}. {truncate(p.text)}\n"
            f"    cid={p.cid}\n"
            f"    up={p.upvotes} down={p.downvotes} ratings={p.ratings} ratio={ratio_str(p.upvote_ratio)} score={p.score} | {meta}"
        )


def print_rollup(title: str, rows: list[dict[str, Any]], limit: int) -> None:
    print(f'\n## {title}')
    if not rows:
        print('(none)')
        return
    for row in rows[:limit]:
        print(
            f"- {row['key']}: prompts={row['prompts']} rated={row['rated_prompts']} "
            f"up={row['upvotes']} down={row['downvotes']} ratio={ratio_str(row['upvote_ratio'])} score={row['score']}"
        )


def build_report(stats: list[PromptStats], limit: int, min_ratings: int) -> dict[str, Any]:
    rated = [p for p in stats if p.ratings > 0]
    qualified = [p for p in stats if p.ratings >= min_ratings]
    unrated = [p for p in stats if p.ratings == 0]

    report = {
        'summary': {
            'prompt_count': len(stats),
            'rated_prompts': len(rated),
            'unrated_prompts': len(unrated),
            'total_upvotes': sum(p.upvotes for p in stats),
            'total_downvotes': sum(p.downvotes for p in stats),
            'total_ratings': sum(p.ratings for p in stats),
            'min_ratings_for_ratio_lists': min_ratings,
        },
        'favorites': [row_dict(p) for p in top(rated, lambda p: (p.upvotes, p.score, -p.downvotes), limit)],
        'least_favorites': [row_dict(p) for p in top(rated, lambda p: (p.downvotes, -p.score, p.upvotes), limit)],
        'best_ratio': [
            row_dict(p)
            for p in top(qualified, lambda p: (p.upvote_ratio or 0.0, p.ratings, p.upvotes), limit)
        ],
        'worst_ratio': [
            row_dict(p)
            for p in bottom(qualified, lambda p: (p.upvote_ratio or 1.0, -p.ratings, -p.downvotes), limit)
        ],
        'polarizing': [
            row_dict(p)
            for p in top(rated, lambda p: (p.polarization, p.ratings, -abs(p.score)), limit)
        ],
        'unrated': [row_dict(p) for p in unrated[:limit]],
        'by_audience': aggregate_by(stats, 'audience'),
        'by_depth': aggregate_by(stats, 'depth'),
        'by_category': aggregate_by(stats, 'category'),
        'by_mode': aggregate_by(stats, 'mode'),
    }
    return report


def downvote_reasons(kv_url: str, kv_token: str, cid: str, limit: int = 10) -> list[str]:
    out = kv_get(kv_url, kv_token, f'lrange/prompt:{cid}:downvoteReasons/0/{max(0, limit - 1)}')
    result = out.get('result', [])
    return result if isinstance(result, list) else []


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description='Aggregate Spill prod thumbs up/down feedback.')
    parser.add_argument('--limit', type=int, default=10, help='Rows per section (default: 10)')
    parser.add_argument('--min-ratings', type=int, default=3, help='Minimum ratings for ratio-based sections')
    parser.add_argument('--json', action='store_true', help='Emit JSON instead of human-readable text')
    parser.add_argument('--cid', help='Inspect a single canonical prompt id')
    parser.add_argument('--reasons-limit', type=int, default=10, help='How many downvote reasons to include for --cid')
    parser.add_argument('--prompt-map-url', default=os.environ.get('PROMPT_MAP_URL', DEFAULT_PROMPT_MAP_URL))
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    kv_url, kv_token = get_secrets()
    prompt_map = load_prompt_map(args.prompt_map_url)
    stats, key_count = prompt_stats_from_store(kv_url, kv_token, prompt_map)

    if args.cid:
        match = next((p for p in stats if p.cid == args.cid), None)
        if not match:
            print(json.dumps({'error': 'cid_not_found', 'cid': args.cid}, indent=2))
            return 1
        out = {
            'cid': args.cid,
            'stored_prompt_hashes': key_count,
            'prompt': row_dict(match),
            'downvote_reasons': downvote_reasons(kv_url, kv_token, args.cid, args.reasons_limit),
        }
        print(json.dumps(out, indent=2))
        return 0

    report = build_report(stats, args.limit, args.min_ratings)

    if args.json:
        print(json.dumps(report, indent=2))
        return 0

    s = report['summary']
    print('# Spill Feedback Report')
    print(
        f"prompts={s['prompt_count']} rated={s['rated_prompts']} unrated={s['unrated_prompts']} "
        f"upvotes={s['total_upvotes']} downvotes={s['total_downvotes']} ratings={s['total_ratings']}"
    )
    print(f"stored_prompt_hashes={key_count} min_ratings_for_ratio_lists={s['min_ratings_for_ratio_lists']}")

    print_section('Favorites', [PromptStats(**{k: v for k, v in item.items() if k in PromptStats.__annotations__}) for item in report['favorites']])
    print_section('Least favorites', [PromptStats(**{k: v for k, v in item.items() if k in PromptStats.__annotations__}) for item in report['least_favorites']])
    print_section('Best upvote ratio', [PromptStats(**{k: v for k, v in item.items() if k in PromptStats.__annotations__}) for item in report['best_ratio']])
    print_section('Worst upvote ratio', [PromptStats(**{k: v for k, v in item.items() if k in PromptStats.__annotations__}) for item in report['worst_ratio']])
    print_section('Most polarizing', [PromptStats(**{k: v for k, v in item.items() if k in PromptStats.__annotations__}) for item in report['polarizing']])
    print_section('Unrated prompts', [PromptStats(**{k: v for k, v in item.items() if k in PromptStats.__annotations__}) for item in report['unrated']])

    print_rollup('By audience', report['by_audience'], args.limit)
    print_rollup('By depth', report['by_depth'], args.limit)
    print_rollup('By category', report['by_category'], args.limit)
    print_rollup('By mode', report['by_mode'], args.limit)
    return 0


if __name__ == '__main__':
    raise SystemExit(main(sys.argv[1:]))
