---
applyTo: "**"
description: Overview instructions for the Steam Vault project.
---

Coding standards, domain knowledge, and preferences that AI should follow.

# Project Overview

Steam Vault is an open-source project that attempts to provide meaningful info about achievements in games on Steam. This consists of not-only static data about games/achievements, but also user-specific data, relating to friends, playtime, locked/unlocked achievements, etc.

## Tool Calls

### `context7`

Included is a builtin tool called `context7`. It is a tool that contains _bleeding edge_ documentation for almost any library or framework available. It is **highly** recommended you use this tool whenever possible, instead of searching for other code in the project.

### `svelte`

Included is a builtin tool called `svelte`. It provides access to the _latest_ Svelte 5 and SvelteKit documentation. You are highly encouraged to use this tool whenever working with Svelte or SvelteKit code.

### `i18n-json`

Included is a custom MCP tool called `i18n-json`. It provides direct access to the localization files used in this project. You are strongly encouraged to use this tool whenever working with localization files.

### Problems

After/during edits, make ample use of the `problems` (or similar) tool to identify issues in the code. This is especially important because you may leave easy mistakes that are easily caught by linters/type-checkers. This is preferable to running `npm run check` unless you wish to check the entire codebase at once.

## Domain Knowledge

### Structure

Steam Vault leverages SvelteKit & Svelte 5 for the "web" portion of the project, and a minimal "worker" exclusively for scheduled tasks. Both parts are tied together by a shared library package that contains the core logic and data structures.

This repository is a monorepo that contains the following packages:

- `@project/lib`: The core library
- `@project/site`: The web application
- `@project/worker`: The worker that runs scheduled tasks

### Production

Everything is currently hosted on Cloudflare Workers. Storage solutions include Cloudflare KV and D1 (sqlite).

## Coding Standards

This project uses npm, BiomeJS for linting and formatting in JS/TS, and Prettier for Svelte files.

### Considerations

Backend resources are **extremely** limited in this project, so the utmost care must be taken when dealing with unknown quantities of data inside of core logic.

## Package Scripts

- `npm run format` - Formats the codebase
- `npm run check` - Runs type checking and linting
- `npm test` - Runs the test suite.
- `npm run db:migration` - Creates a database migration in `/packages/lib/drizzle`
- `npm run db:migrate` - Applies database migrations

When you need to recompile/build/etc. code, don't attempt to do so manually. Always use the provided scripts. To run the site, simply request the user to start the development server. If a tool like `chrome-devtools` is available, you can use that to interface/debug the site itself.

## Preferences

When writing code, please keep readability in mind. Avoid removing helpful comments, or ensure that they are replaced with equally helpful comments. Avoid comments describing what you are changing, except when documenting explicit behaviors (e.g. why a certain approach was taken).

Other nitpicks:

- Prioritize early returns in functions.
  - Avoid early returns such as `if (x.length === 0) return []` except to avoid runtime errors
- Avoid using `any` type whenever possible
  - Include an appropriate `// @ts-expect-error` comment
- Avoid using `as` or `!` type assertions
  - Use `satisfies` keyword when applicable
  - Use `throw new Error()` for type narrowing
