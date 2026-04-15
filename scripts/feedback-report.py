#!/usr/bin/env python3
"""Aggregate Spill prod thumbs up/down feedback from Upstash Redis.

One-file report for the common questions:
- favorites (most upvotes)
- least favorites (most downvotes)
- best / worst upvote ratio with minimum sample size
- most polarizing questions
- unrated questions
- rollups by audience, depth, category, and mode

Defaults:
- loads Redis REST URL + read-only token from Proton Pass
- loads question metadata from deployed /api/question-map

Env overrides:
- KV_REST_API_URL
- KV_REST_API_READ_ONLY_TOKEN
- QUESTION_MAP_URL
- PROMPT_MAP_URL (legacy alias)

Examples:
  python3 scripts/feedback-report.py
  python3 scripts/feedback-report.py --limit 15 --min-ratings 3
  python3 scripts/feedback-report.py --json
  python3 scripts/feedback-report.py --cid friends-light-01-uy966a
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from collections import defaultdict
from dataclasses import dataclass
from typing import Any, Iterable
from urllib.request import Request, urlopen

DEFAULT_QUESTION_MAP_URL = 'https://www.spill.cards/api/question-map'
READ_ONLY_TOKEN_TITLE = 'feedback_KV_REST_API_READ_ONLY_TOKEN'
KV_URL_TITLE = 'feedback_KV_REST_API_URL'


@dataclass
class QuestionStats:
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
    kv_token = os.environ.get('KV_REST_API_READ_ONLY_TOKEN') or pass_value(
        READ_ONLY_TOKEN_TITLE
    )
    return kv_url, kv_token


def http_json(
    url: str,
    headers: dict[str, str] | None = None,
    body: Any | None = None,
) -> dict[str, Any]:
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


def scan_question_keys(kv_url: str, kv_token: str) -> list[str]:
    keys: list[str] = []
    cursor = '0'
    while True:
        out = kv_cmd(
            kv_url,
            kv_token,
            ['SCAN', cursor, 'MATCH', 'question:*', 'COUNT', '200'],
        )
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


def load_question_map(question_map_url: str) -> dict[str, dict[str, Any]]:
    out = http_json(question_map_url)
    questions = out.get('questions')
    if not isinstance(questions, list):
        questions = out.get('prompts', [])
    return {question['cid']: question for question in questions}


def question_stats_from_store(
    kv_url: str,
    kv_token: str,
    question_map: dict[str, dict[str, Any]],
) -> tuple[list[QuestionStats], int]:
    keys = scan_question_keys(kv_url, kv_token)
    stats: list[QuestionStats] = []

    for key in keys:
        cid = key.removeprefix('question:')
        fields = hgetall_dict(kv_url, kv_token, key)
        meta = question_map.get(cid, {})
        stats.append(
            QuestionStats(
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

    seen_cids = {stat.cid for stat in stats}
    for cid, meta in question_map.items():
        if cid in seen_cids:
            continue
        stats.append(
            QuestionStats(
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


def top(items: list[QuestionStats], key_fn, limit: int) -> list[QuestionStats]:
    return sorted(items, key=key_fn, reverse=True)[:limit]


def bottom(items: list[QuestionStats], key_fn, limit: int) -> list[QuestionStats]:
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


def row_dict(question: QuestionStats) -> dict[str, Any]:
    return {
        'cid': question.cid,
        'id': question.id,
        'text': question.text,
        'audience': question.audience,
        'depth': question.depth,
        'mode': question.mode,
        'category': question.category,
        'upvotes': question.upvotes,
        'downvotes': question.downvotes,
        'ratings': question.ratings,
        'score': question.score,
        'upvote_ratio': question.upvote_ratio,
        'polarization': question.polarization,
    }


def aggregate_by(items: Iterable[QuestionStats], field: str) -> list[dict[str, Any]]:
    bucket: dict[str, dict[str, Any]] = defaultdict(
        lambda: {
            'key': None,
            'questions': 0,
            'rated_questions': 0,
            'upvotes': 0,
            'downvotes': 0,
            'ratings': 0,
            'score': 0,
        }
    )

    for question in items:
        values: list[str]
        if field == 'audience':
            values = question.audience or ['—']
        else:
            values = [getattr(question, field) or '—']

        for value in values:
            row = bucket[value]
            row['key'] = value
            row['questions'] += 1
            row['upvotes'] += question.upvotes
            row['downvotes'] += question.downvotes
            row['ratings'] += question.ratings
            row['score'] += question.score
            if question.ratings > 0:
                row['rated_questions'] += 1

    rows = list(bucket.values())
    for row in rows:
        row['upvote_ratio'] = (
            None if row['ratings'] == 0 else row['upvotes'] / row['ratings']
        )
    rows.sort(
        key=lambda row: (row['score'], row['upvotes'], -row['downvotes']),
        reverse=True,
    )
    return rows


def print_section(title: str, items: list[QuestionStats]) -> None:
    print(f'\n## {title}')
    if not items:
        print('(none)')
        return

    for idx, question in enumerate(items, start=1):
        meta = (
            ' · '.join(
                [
                    value
                    for value in [
                        question.depth,
                        question.mode,
                        question.category,
                    ]
                    if value
                ]
            )
            or '—'
        )
        print(
            f"{idx:>2}. {truncate(question.text)}\n"
            f"    cid={question.cid}\n"
            f"    up={question.upvotes} down={question.downvotes} ratings={question.ratings} ratio={ratio_str(question.upvote_ratio)} score={question.score} | {meta}"
        )


def print_rollup(title: str, rows: list[dict[str, Any]], limit: int) -> None:
    print(f'\n## {title}')
    if not rows:
        print('(none)')
        return
    for row in rows[:limit]:
        print(
            f"- {row['key']}: questions={row['questions']} rated={row['rated_questions']} "
            f"up={row['upvotes']} down={row['downvotes']} ratio={ratio_str(row['upvote_ratio'])} score={row['score']}"
        )


def build_report(
    stats: list[QuestionStats],
    limit: int,
    min_ratings: int,
) -> dict[str, Any]:
    rated = [question for question in stats if question.ratings > 0]
    qualified = [question for question in stats if question.ratings >= min_ratings]
    unrated = [question for question in stats if question.ratings == 0]

    return {
        'summary': {
            'question_count': len(stats),
            'rated_questions': len(rated),
            'unrated_questions': len(unrated),
            'total_upvotes': sum(question.upvotes for question in stats),
            'total_downvotes': sum(question.downvotes for question in stats),
            'total_ratings': sum(question.ratings for question in stats),
            'min_ratings_for_ratio_lists': min_ratings,
        },
        'favorites': [
            row_dict(question)
            for question in top(
                rated,
                lambda question: (
                    question.upvotes,
                    question.score,
                    -question.downvotes,
                ),
                limit,
            )
        ],
        'least_favorites': [
            row_dict(question)
            for question in top(
                rated,
                lambda question: (
                    question.downvotes,
                    -question.score,
                    question.upvotes,
                ),
                limit,
            )
        ],
        'best_ratio': [
            row_dict(question)
            for question in top(
                qualified,
                lambda question: (
                    question.upvote_ratio or 0.0,
                    question.ratings,
                    question.upvotes,
                ),
                limit,
            )
        ],
        'worst_ratio': [
            row_dict(question)
            for question in bottom(
                qualified,
                lambda question: (
                    question.upvote_ratio or 1.0,
                    -question.ratings,
                    -question.downvotes,
                ),
                limit,
            )
        ],
        'polarizing': [
            row_dict(question)
            for question in top(
                rated,
                lambda question: (
                    question.polarization,
                    question.ratings,
                    -abs(question.score),
                ),
                limit,
            )
        ],
        'unrated': [row_dict(question) for question in unrated[:limit]],
        'by_audience': aggregate_by(stats, 'audience'),
        'by_depth': aggregate_by(stats, 'depth'),
        'by_category': aggregate_by(stats, 'category'),
        'by_mode': aggregate_by(stats, 'mode'),
    }


def downvote_reasons(
    kv_url: str,
    kv_token: str,
    cid: str,
    limit: int = 10,
) -> list[str]:
    out = kv_get(
        kv_url,
        kv_token,
        f'lrange/question:{cid}:downvoteReasons/0/{max(0, limit - 1)}',
    )
    result = out.get('result', [])
    return result if isinstance(result, list) else []


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description='Aggregate Spill prod thumbs up/down feedback.'
    )
    parser.add_argument('--limit', type=int, default=10, help='Rows per section (default: 10)')
    parser.add_argument(
        '--min-ratings',
        type=int,
        default=3,
        help='Minimum ratings for ratio-based sections',
    )
    parser.add_argument(
        '--json', action='store_true', help='Emit JSON instead of human-readable text'
    )
    parser.add_argument('--cid', help='Inspect a single canonical question id')
    parser.add_argument(
        '--reasons-limit',
        type=int,
        default=10,
        help='How many downvote reasons to include for --cid',
    )
    parser.add_argument(
        '--question-map-url',
        '--prompt-map-url',
        dest='question_map_url',
        default=(
            os.environ.get('QUESTION_MAP_URL')
            or os.environ.get('PROMPT_MAP_URL')
            or DEFAULT_QUESTION_MAP_URL
        ),
        help='Question map endpoint URL (legacy --prompt-map-url alias also supported)',
    )
    return parser.parse_args(argv)


def main(argv: list[str]) -> int:
    args = parse_args(argv)
    kv_url, kv_token = get_secrets()
    question_map = load_question_map(args.question_map_url)
    stats, key_count = question_stats_from_store(kv_url, kv_token, question_map)

    if args.cid:
        match = next((question for question in stats if question.cid == args.cid), None)
        if not match:
            print(json.dumps({'error': 'cid_not_found', 'cid': args.cid}, indent=2))
            return 1
        out = {
            'cid': args.cid,
            'stored_question_hashes': key_count,
            'question': row_dict(match),
            'downvote_reasons': downvote_reasons(
                kv_url,
                kv_token,
                args.cid,
                args.reasons_limit,
            ),
        }
        print(json.dumps(out, indent=2))
        return 0

    report = build_report(stats, args.limit, args.min_ratings)

    if args.json:
        print(json.dumps(report, indent=2))
        return 0

    summary = report['summary']
    print('# Spill Feedback Report')
    print(
        f"questions={summary['question_count']} rated={summary['rated_questions']} unrated={summary['unrated_questions']} "
        f"upvotes={summary['total_upvotes']} downvotes={summary['total_downvotes']} ratings={summary['total_ratings']}"
    )
    print(
        f"stored_question_hashes={key_count} min_ratings_for_ratio_lists={summary['min_ratings_for_ratio_lists']}"
    )

    print_section(
        'Favorites',
        [
            QuestionStats(
                **{
                    key: value
                    for key, value in item.items()
                    if key in QuestionStats.__annotations__
                }
            )
            for item in report['favorites']
        ],
    )
    print_section(
        'Least favorites',
        [
            QuestionStats(
                **{
                    key: value
                    for key, value in item.items()
                    if key in QuestionStats.__annotations__
                }
            )
            for item in report['least_favorites']
        ],
    )
    print_section(
        'Best upvote ratio',
        [
            QuestionStats(
                **{
                    key: value
                    for key, value in item.items()
                    if key in QuestionStats.__annotations__
                }
            )
            for item in report['best_ratio']
        ],
    )
    print_section(
        'Worst upvote ratio',
        [
            QuestionStats(
                **{
                    key: value
                    for key, value in item.items()
                    if key in QuestionStats.__annotations__
                }
            )
            for item in report['worst_ratio']
        ],
    )
    print_section(
        'Most polarizing',
        [
            QuestionStats(
                **{
                    key: value
                    for key, value in item.items()
                    if key in QuestionStats.__annotations__
                }
            )
            for item in report['polarizing']
        ],
    )
    print_section(
        'Unrated questions',
        [
            QuestionStats(
                **{
                    key: value
                    for key, value in item.items()
                    if key in QuestionStats.__annotations__
                }
            )
            for item in report['unrated']
        ],
    )

    print_rollup('By audience', report['by_audience'], args.limit)
    print_rollup('By depth', report['by_depth'], args.limit)
    print_rollup('By category', report['by_category'], args.limit)
    print_rollup('By mode', report['by_mode'], args.limit)
    return 0


if __name__ == '__main__':
    raise SystemExit(main(sys.argv[1:]))
