# Agent Instructions

This is the canonical entrypoint for agents working in this repository. Read this file first, then read only the focused files relevant to the change.

## Project

Steam Vault helps users find meaningful Steam achievement information across games, users, friends, playtime, unlocked achievements, rarity, and related Steam data.

The repository is an npm workspace with three main packages:

- `packages/lib`: shared Steam API clients, models, repositories, database logic, scoring, and ML prediction code.
- `packages/site`: SvelteKit application, routes, components, hooks, styling, and localization.
- `packages/worker`: Cloudflare Worker scheduled/background jobs.

Production runs on Cloudflare Workers. Storage includes Cloudflare D1 and KV. Backend work must account for limited CPU, memory, query limits, and external Steam API reliability.

## Read Next

- `.agents/instructions/project.md`: package boundaries and runtime targets.
- `.agents/instructions/workflows.md`: development commands, dev server behavior, and generated files.
- `.agents/instructions/validation.md`: validation matrix by change type.
- `.agents/rules/known-failure-modes.md`: project-specific patterns that have caused repeated agent regressions.
- `.agents/rules/drizzle.md`: Drizzle, D1, query composition, and batching constraints.
- `.agents/rules/svelte.md`: SvelteKit and Svelte 5 expectations.
- `.agents/rules/translations.md`: Paraglide and localization workflow.
- `.agents/rules/typescript.md`: TypeScript/runtime guidance.

## Core Operating Rules

- Prefer existing package boundaries and local patterns over new abstractions.
- Put shared Steam, database, repository, and scoring logic in `packages/lib`; keep Svelte routes focused on request handling and presentation.
- Avoid unbounded work in request paths, scheduled jobs, and repository code.
- Use targeted validation from `.agents/instructions/validation.md` before handing work back.
- Do not read huge generated or localization files into the session; use the translation workflow instead.
