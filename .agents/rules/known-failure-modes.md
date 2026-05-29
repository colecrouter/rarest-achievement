# Known Failure Modes

These are project-specific patterns that have repeatedly caused bad agent changes.

## Drizzle Read Chunking

Do not solve D1 parameter limits by chunking read queries, manually batching `inArray`, or fetching IDs from one query to feed an unbounded second query. Use query composition and repository helpers.

See `.agents/rules/drizzle.md`.

## Translation Context Loops

Do not read all locale files or generated Paraglide files into context. The files are large enough to derail sessions and hide the actual change.

Use the i18n workflow in `.agents/rules/translations.md`.

## Duplicate Dev Servers

Do not start a new dev server without checking for an existing one. Reuse an existing site server when available.

## Shared Logic In Routes

Avoid embedding reusable Steam, repository, scoring, or database logic directly in SvelteKit routes. Put shared behavior in `packages/lib` and keep routes focused on request-specific orchestration.

## Unbounded External Fetches

Steam and related external APIs can be slow, incomplete, rate-limited, or unavailable. Avoid introducing loops where request volume grows with an unknown number of users, friends, apps, or achievements unless the existing fetch-budget patterns support it.

