# spill

Spill is a small Vite app for drawing conversation prompts and wildcards, with a lightweight Vercel Edge API for prompt metadata and anonymous feedback aggregation.

## Quick start

```bash
pnpm setup
pnpm dev
```

Open http://localhost:5173.

## Scripts

| Command                 | What it does                                            |
| ----------------------- | ------------------------------------------------------- |
| `pnpm dev`              | Start the local Vite dev server                         |
| `pnpm build`            | Typecheck the app + API and build production assets     |
| `pnpm preview`          | Preview the production build locally                    |
| `pnpm check`            | Run TypeScript checks for app and API code              |
| `pnpm lint:fast`        | Run Oxlint for fast lint feedback                       |
| `pnpm lint`             | Run ESLint                                              |
| `pnpm format:check`     | Check formatting with Prettier                          |
| `pnpm test`             | Run Vitest                                              |
| `pnpm test:coverage`    | Run tests with V8 coverage thresholds                   |
| `pnpm test:ci`          | Run Vitest with coverage plus JUnit/JSON reports        |
| `pnpm test:integration` | Run Playwright smoke tests                              |
| `pnpm quality`          | Run the repo quality gate used in CI                    |
| `pnpm size:check`       | Enforce file-size budgets                               |
| `pnpm tech-debt`        | Fail on unchecked `TODO` / `FIXME` / `HACK` markers     |
| `pnpm validate:agents`  | Verify AGENTS.md command and file references stay valid |
| `pnpm flags:check`      | Detect expired or unused feature flags                  |
| `pnpm unused:deps`      | Detect unused files and dependencies with Knip          |
| `pnpm duplicate-code`   | Detect duplicate source blocks with jscpd               |
| `pnpm docs:generate`    | Generate API/reference docs with TypeDoc                |

## Environment

Copy `.env.example` to `.env.local` when you need production-like feedback writes locally.

| Variable                   | Required | Purpose                                                  |
| -------------------------- | -------- | -------------------------------------------------------- |
| `KV_REST_API_URL`          | API only | Upstash Redis REST endpoint used by `/api/feedback`      |
| `KV_REST_API_TOKEN`        | API only | Upstash Redis REST token                                 |
| `VITE_ENABLE_AGENTATION`   | optional | Enables the Agentation dev overlay locally               |
| `VITE_OBSERVABILITY_DEBUG` | optional | Enables extra client-side structured logs in development |

## Repo map

- `app/` – browser app, prompt library, UI, local analytics
- `api/` – Vercel Edge functions
- `lib/` – shared observability and logging helpers
- `docs/` – architecture, API schema, runbooks
- `scripts/` – repository guardrails used in CI and pre-commit
- `.github/` – CI, templates, labels, automation

## Architecture and operations

- Architecture: [`docs/architecture.md`](docs/architecture.md)
- API schema: [`openapi.yaml`](openapi.yaml)
- Runbooks: [`docs/runbooks.md`](docs/runbooks.md)
- Agent guidance: [`AGENTS.md`](AGENTS.md)

## Feature flags

Feature flags are intentionally lightweight. `app/feature-flags.ts` supports:

- env defaults via `VITE_*`
- local overrides via `localStorage`
- query-string overrides for quick experiments

Current flag: `agentationDevtools`.

Example:

```js
localStorage.setItem(
  'spill:feature-flags',
  JSON.stringify({ agentationDevtools: true }),
)
```

## Testing

Vitest covers:

- prompt-library behavior
- slug generation
- deployed prompt map generation
- Edge API handlers

Playwright covers:

- landing-page smoke flow
- filters modal availability
- drawing a card
- downvote modal flow

Coverage thresholds are configured in `vitest.config.ts` for the core prompt + API surface. CI stores JUnit/JSON test reports for both Vitest and Playwright.

## Release workflow

Spill uses Changesets for release notes and version planning.

1. Create a changeset for user-visible changes: `pnpm changeset`
2. Merge to `main`
3. GitHub Actions updates or opens the release PR
4. Vercel deploys from the merged branch

## Observability

- API handlers emit structured JSON logs
- responses include `X-Request-Id`
- feedback writes propagate request IDs to Upstash
- failing Quality, Integration, and Vercel Deploy workflows auto-open/update GitHub issues via `.github/workflows/workflow-alerts.yml`
- GitHub Actions dashboard: https://github.com/selah-tools/spill/actions
- Vercel deploy dashboard: https://vercel.com/selah-tools/spill
- runbooks document how to debug failed feedback writes

## Security and maintenance

- Renovate config lives in `renovate.json`
- label sync + PR auto-labeling live in `.github/workflows/labels.yml`
- secret scanning runs with Gitleaks in CI
- CODEOWNERS is defined in `.github/CODEOWNERS`

## Notes for agents

If you are editing this repo with an agent, read [`AGENTS.md`](AGENTS.md) before making changes.
