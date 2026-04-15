# Architecture

Spill is a static-first Vite app backed by two tiny Vercel Edge functions.

```mermaid
flowchart TD
  A[Browser app] --> B[/api/prompt-map]
  A --> C[/api/feedback]
  C --> D[(Upstash Redis REST API)]
  A --> E[(localStorage)]
  F[GitHub Actions] --> G[Vercel deploy]
```

## Frontend

- `app/app.ts` is the main entry point.
- Prompt metadata comes from `app/prompts.ts` + `app/prompts.json`.
- Local preferences, seen prompts, and optimistic feedback live in `localStorage`.
- Feature flags are handled in `app/feature-flags.ts`.

## API

### `GET /api/prompt-map`

Returns deployed prompt metadata by canonical ID, or the full deployed map.

### `POST /api/feedback`

Validates a canonical prompt ID, maps the event to counters, and writes counters + event history to Upstash over the REST API.

## Observability

- API logs are structured JSON.
- All API responses include `X-Request-Id`.
- Feedback requests forward request IDs to Upstash for traceability.
- Sensitive fields are scrubbed before logging.

## Delivery

- `quality.yml` runs lint, format, typecheck, tests, coverage, file-size checks, tech-debt checks, Knip, and jscpd.
- `vercel.yml` handles preview and production deploys.
- `release.yml` manages Changesets-based release PRs.
