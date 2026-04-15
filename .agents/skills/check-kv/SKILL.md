---
name: checking-kv
description: Inspect Spill's production feedback KV in Upstash Redis to verify thumbs up/down writes and extract prompt-performance insights from rating counters. Use when asked to check whether production rating feedback is working, analyze top or weak prompts by upvotes/downvotes, inspect thumbs up/down counts, debug rating ingestion, or summarize trends from the KV store.
---

# Checking KV

Inspect Spill's production feedback store in Upstash Redis.

This skill is for **reading and analyzing** the prod feedback KV, not editing app code.

## Quick Start

Use the single-file aggregation script for most analysis:

```bash
python3 scripts/feedback-report.py
python3 scripts/feedback-report.py --limit 15 --min-ratings 3
python3 scripts/feedback-report.py --json
python3 scripts/feedback-report.py --cid friends-light-01-uy966a
```

If you need raw access, load the KV credentials from Proton Pass:

```bash
KV_URL=$(pass-cli item view --vault-name "Agent Secrets" --item-title "feedback_KV_REST_API_URL" --field password)
KV_TOKEN=$(pass-cli item view --vault-name "Agent Secrets" --item-title "feedback_KV_REST_API_READ_ONLY_TOKEN" --field password)
```

Sanity check the store:

```bash
curl -s -X POST "$KV_URL" \
  -H "Authorization: Bearer $KV_TOKEN" \
  -H "Content-Type: application/json" \
  -d '["PING"]' | jq .
```

Read one prompt's counters:

```bash
CID="friends-light-01-uy966a"
curl -s -H "Authorization: Bearer $KV_TOKEN" \
  "$KV_URL/hgetall/prompt:$CID" | jq .
```

Read recent downvote explanations for one prompt:

```bash
CID="friends-light-01-uy966a"
curl -s -H "Authorization: Bearer $KV_TOKEN" \
  "$KV_URL/lrange/prompt:$CID:downvoteReasons/0/9" | jq .
```

Resolve a canonical ID to prompt text from the deployed app itself:

```bash
curl -s "https://www.spill.cards/api/prompt-map?cid=friends-light-01-uy966a" | jq .
```

Fetch the full deployed prompt map:

```bash
curl -s "https://www.spill.cards/api/prompt-map" | jq '.count'
```

## Data Model

Spill stores production rating feedback in these Redis key patterns:

- `prompt:{cid}` → hash of rating counters for one prompt
- `prompt:{cid}:downvoteReasons` → capped list of free-text downvote explanations for that prompt

### Canonical prompt ID

The counter key suffix uses the app's canonical ID format:

```text
{english-id}-{content-hash}
```

Example:

```text
friends-light-01-uy966a
```

### Prompt counter fields

A prompt hash currently stores only these fields in production:

- `upvotes`
- `downvotes`

Downvote explanations are stored alongside the prompt in a separate capped list key.
Views, copies, shares, wildcard draws, and the old global event log are not persisted to prod KV.

## Core Workflows

### 1) Verify production feedback is working

Use this when the user asks if prod thumbs up/down is actually landing.

1. Load `feedback_KV_REST_API_URL`
2. Load `feedback_KV_REST_API_READ_ONLY_TOKEN`
3. Check one known prompt hash under `prompt:{cid}`
4. Report what changed, not just whether the API returned `ok:true`

Minimal check:

```bash
curl -s -H "Authorization: Bearer $KV_TOKEN" \
  "$KV_URL/hgetall/prompt:friends-light-01-uy966a" | jq .
```

### 2) Inspect a single prompt

When the user asks how one prompt is performing:

```bash
CID="friends-light-01-uy966a"
curl -s -H "Authorization: Bearer $KV_TOKEN" \
  "$KV_URL/hgetall/prompt:$CID" | jq .
```

If you need the human-readable text, look up the canonical ID in `app/prompts.json` or compute it from the prompt library.

### 3) List prompt keys

Use Redis `SCAN` via the REST command endpoint:

```bash
curl -s -X POST "$KV_URL" \
  -H "Authorization: Bearer $KV_TOKEN" \
  -H "Content-Type: application/json" \
  -d '["SCAN","0","MATCH","prompt:*","COUNT","200"]' | jq .
```

The result is `[cursor, keys[]]`. Keep scanning until the cursor becomes `"0"`.

### 4) Compute simple rankings

Default to the one-file report script:

```bash
python3 scripts/feedback-report.py
python3 scripts/feedback-report.py --limit 20 --min-ratings 5
python3 scripts/feedback-report.py --json
```

This covers:

- favorites
- least favorites
- best upvote ratio
- worst upvote ratio
- most polarizing prompts
- unrated prompts
- rollups by audience, depth, category, and mode

## Insight Patterns

Use these heuristics when summarizing results:

- **Polarizing prompt**: both upvotes and downvotes are non-trivial
- **Weak prompt**: downvotes exceed or approach upvotes
- **Reliable winner**: many upvotes with low downvotes
- **Unproven prompt**: little or no rating data yet

Prefer reporting:

- top prompts by upvotes
- top prompts by upvote ratio with a minimum sample size
- prompts with highest downvotes
- prompts with no rating signal yet

## Correlate KV data with prompt text

KV keys only store `cid`. To turn that into readable insights, prefer the deployed prompt map endpoint:

- `/api/prompt-map` — full map for that deployment
- `/api/prompt-map?cid=...` — single prompt lookup

Example:

```bash
curl -s "https://www.spill.cards/api/prompt-map?cid=friends-light-01-uy966a" | jq .
```

If the deployed endpoint is unavailable, fall back to local files:

- `app/prompts.json` — source prompt library
- `app/card-slug.ts` — canonical ID logic
- `app/prompts.ts` — prompt types and metadata

Use this when the user asks for:

- best prompts by text
- worst prompts by text
- trends by audience, depth, category, or mode

## Guidelines

- Default to the **read-only token** for analysis.
- Use the write token only when explicitly testing write behavior.
- Do not paste raw tokens in normal output.
- Quote canonical IDs exactly.
- Do not claim KV is working unless you verify the data changed in Redis.
- When reporting rankings, note whether they are based on raw counts or ratios.
- For ratio-based conclusions, require a minimum sample size when possible.
- Distinguish between **API success** and **storage success**; the latter requires reading back the key.

## Useful Commands

Load the write token only for ingestion tests:

```bash
KV_WRITE_TOKEN=$(pass-cli item view --vault-name "Agent Secrets" --item-title "feedback_KV_REST_API_TOKEN" --field password)
```

Write test directly to Upstash:

```bash
curl -s -X POST "$KV_URL" \
  -H "Authorization: Bearer $KV_WRITE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '["HINCRBY","prompt:friends-light-01-uy966a","upvotes",1]' | jq .
```

Read back the key immediately:

```bash
curl -s -H "Authorization: Bearer $KV_TOKEN" \
  "$KV_URL/hgetall/prompt:friends-light-01-uy966a" | jq .
```
