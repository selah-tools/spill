# Architecture

Spill is a static-first Vite app backed by four small Vercel Edge functions.

```mermaid
flowchart TD
  A[Browser app] --> B[/api/question-map]
  A --> C[/api/feedback]
  A --> D[/api/feedback-explorer]
  A --> E[/api/questions-source]
  C --> F[(Upstash Redis REST API)]
  D --> F
  E --> F
  A --> G[(localStorage)]
  H[GitHub Actions] --> I[Vercel deploy]
```

## Frontend

- `app/app.ts` is the main entry point.
- Question metadata comes from `app/questions.ts` + `app/questions.json`.
- Local preferences, seen questions, and optimistic feedback live in `localStorage`.
- Feature flags are handled in `app/feature-flags.ts`.

## API

### `GET /api/question-map`

Returns deployed question metadata by canonical ID, or the full deployed map.

### `POST /api/feedback`

Validates a canonical question ID, maps the event to counters, and writes counters plus downvote reasons to Upstash over the REST API.

## Observability

- API logs are structured JSON via `lib/observability.ts`.
- All API responses include `X-Request-Id`.
- Feedback requests forward request IDs to Upstash for traceability.
- Sensitive fields are scrubbed before logging.
- Browser error tracking is handled by Sentry via `app/sentry.ts`.
- API troubleshooting currently relies on structured logs, `X-Request-Id`, and Upstash request correlation.
- CI workflow alerts create GitHub Issues automatically when Quality, Integration, or deploy workflows fail on `main`.

## Delivery

- `quality.yml` runs lint, format, typecheck, tests, coverage, file-size checks, tech-debt checks, Knip, and jscpd.
- `vercel.yml` handles preview and production deploys.
- `release.yml` manages Changesets-based release PRs.
