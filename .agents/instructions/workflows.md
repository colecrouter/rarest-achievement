# Workflows

## Common Commands

- Install dependencies: `npm ci`
- Run the site: `npm run dev --workspace=@project/site`
- Run all workspace dev tasks: `npm run dev`
- Build the site: `npm run build --workspace=@project/site`
- Check all packages: `npm run check`
- Test all packages: `npm test`
- Format everything: `npm run format`
- Check formatting/linting in CI style: `npm run format:check`
- Create a lib database migration: `npm run db:migration --workspace=@project/lib`
- Apply database migrations: `npm run db:migrate`

## Dev Server

Do not assume the dev server is stopped. Before starting one, check whether a suitable server is already running or whether the active browser/session already has one.

If a server is already running, reuse it. If a new server is needed, use an available port and report the URL.

## Generated And Large Files

Avoid reading generated or very large files into the agent session.

- Do not read `packages/site/src/lib/paraglide` during normal localization work.
- Do not dump every file in `packages/site/messages` into context.
- Treat `packages/*/worker-configuration.d.ts` as generated.
- Drizzle migrations and snapshots are generated first; manual edits should be intentional and reviewed.
- `packages/lib/steam_model.json` is produced by the Python training pipeline.

## Formatting

Biome formats and lints. Prefer the package scripts over ad hoc formatting commands.
