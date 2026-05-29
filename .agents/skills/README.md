# Skills And Tools

This folder documents project-specific tool expectations. It is not a replacement for an agent's own skill/plugin system.

## Documentation Tools

When current library behavior matters, prefer official documentation or an available docs MCP tool.

Useful domains:

- Svelte and SvelteKit for frontend behavior.
- Drizzle ORM for query builder behavior.
- Paraglide/Inlang for localization behavior.

## Local Translation Tool

The preferred localization workflow uses the local `i18n-json` MCP tool when it is available. The purpose is context control as much as convenience: use structured key queries and parity checks instead of reading full locale files.
