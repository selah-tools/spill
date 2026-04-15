# AGENTS.md

## Working agreement

- Use `pnpm` for all package management and scripts.
- Prefer precise edits over broad rewrites.
- Run the narrowest verification step that matches the change, then run `pnpm quality` before shipping broader repo changes.
- Keep changes documented when they affect setup, quality tooling, release flow, or observability.

## Repo overview

- `app/`: Vite frontend and prompt-selection logic
- `api/`: Vercel Edge handlers
- `lib/`: shared observability helpers
- `docs/`: architecture, runbooks, and OpenAPI schema
- `scripts/`: CI guardrails like size and tech-debt checks

## Commands

```bash
pnpm dev
pnpm build
pnpm lint:fast
pnpm quality
pnpm test:integration
pnpm validate:agents
pnpm flags:check
pnpm docs:generate
```

## Conventions

- TypeScript runs in `strict` mode.
- Oxlint is the fast first-pass linter.
- ESLint remains the authoritative lint layer for naming conventions and complexity warnings.
- Prettier owns formatting.
- Avoid adding `TODO`, `FIXME`, or `HACK` markers without a linked issue or a planned follow-up.
- Keep prompt-related IDs deterministic. The canonical ID format is `{prompt-id}-{hash}`.

## Testing expectations

- Add or update tests for prompt logic and API behavior.
- Keep API responses JSON-only and include `X-Request-Id` headers.
- Prefer deterministic tests with mocked network I/O.
- Keep Playwright smoke tests green for core flows.

## Environment

See `.env.example` for documented variables. Do not commit real secrets.

## Validation automation

- `pnpm validate:agents` checks that commands and file references in `AGENTS.md` stay valid.
- `pnpm flags:check` detects expired or unused feature flags from `app/feature-flags.json`.

## Release notes

Create a changeset for user-visible changes with:

```bash
pnpm changeset
```
