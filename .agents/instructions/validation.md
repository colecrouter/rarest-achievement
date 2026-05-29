# Validation Matrix

Run the narrowest validation that gives useful signal, then broaden when the change crosses package boundaries.

## TypeScript Or Shared Library Changes

- `npm run check --workspace=@project/lib`
- `npm test --workspace=@project/lib`

Use this for changes under `packages/lib/src`, repository code, models, Steam API clients, scoring, and ML consumers.

## SQLite, D1, Drizzle, Or Repository Changes

- `npm run check --workspace=@project/lib`
- `npm test --workspace=@project/lib`

Also run focused tests under `packages/lib/test/sqlite` when possible. Schema or migration changes should include generated Drizzle migration artifacts and relevant repository coverage.

## SvelteKit Routes, Components, Hooks, Or Styling

- `npm run check --workspace=@project/site`
- `npm test --workspace=@project/site`

For user-visible UI changes, inspect the rendered page when practical.

## Localization Changes

- Use the translation workflow in `.agents/rules/translations.md`.
- Check key parity with the i18n tool when available.
- Run `npm run check --workspace=@project/site`.

## Worker Changes

- `npm run check --workspace=@project/worker`
- `npm test --workspace=@project/worker`

If worker behavior depends on shared library logic, also run relevant `@project/lib` tests.

## Cross-Package Changes

- `npm run check`
- `npm test`
- `npm run build --workspace=@project/site` when route, adapter, Cloudflare, or bundled behavior may be affected.

## Formatting And Linting Issues

Use `npm run format:check` to reproduce CI style checks. Use `npm run format` only when broad formatting changes are acceptable for the current task.
