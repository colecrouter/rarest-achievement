# Svelte And SvelteKit Rules

This project uses Svelte 5 and SvelteKit on Cloudflare.

## Documentation

When Svelte or SvelteKit behavior is uncertain, prefer current official documentation or an available Svelte documentation tool over guessing from memory.

## Boundaries

- Keep route server files focused on loading, request handling, redirects, and response shaping.
- Move reusable domain logic into `packages/lib`.
- Keep browser-only behavior out of server modules.
- Be mindful of Cloudflare runtime constraints in server-load and API route code.

## Components

- Follow existing component patterns in `packages/site/src/lib` and route-local components.
- Keep translation keys outside hard-coded user-facing strings unless the string is intentionally not localized.
- Run `npm run check --workspace=@project/site` after Svelte changes.

