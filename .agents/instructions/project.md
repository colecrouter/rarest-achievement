# Project Map

## Packages

`packages/lib` is the core package. It owns:

- Steam API clients and response types.
- Domain models for users, apps, achievements, friends, and owned games.
- SQLite/D1 repositories and shared query helpers.
- Fetch budgeting and repository composition.
- ML prediction and scoring helpers.
- Repository and model tests.

`packages/site` is the SvelteKit application. It owns:

- User-facing routes, layouts, components, and styles.
- Svelte server-load code and API routes.
- Paraglide localization inputs.
- Cloudflare adapter configuration and browser-facing behavior.

`packages/worker` owns background and scheduled work. Keep worker code small and use `packages/lib` for shared logic.

`python/xgboost_model` contains the training pipeline that produces the Steam model consumed by `packages/lib`.

## Runtime Targets

The codebase targets modern TypeScript, SvelteKit, Cloudflare Workers, D1/SQLite, and modern browsers. CI currently runs Node 22. Do not assume a newer runtime feature is safe everywhere unless the package target supports it.

Cloudflare constraints matter for both site and worker code:

- Avoid memory-heavy transforms.
- Avoid unbounded loops over Steam, user, friend, app, or achievement collections.
- Treat Steam APIs as incomplete, slow, rate-limited, or intermittently unavailable.
- Prefer repository-level fetch budgeting and existing caching patterns.

## Ownership Rules

- If logic is shared by route handlers, worker jobs, or tests, put it in `packages/lib`.
- If logic is specific to rendering or user interaction, keep it in `packages/site`.
- If logic is scheduled/background-only, keep orchestration in `packages/worker` and shared behavior in `packages/lib`.
- Database schema and repository changes usually require matching tests under `packages/lib/test`.
