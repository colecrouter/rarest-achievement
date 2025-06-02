---
applyTo: "**"
---

Coding standards, domain knowledge, and preferences that AI should follow.

# Project Overview

Steam Vault is an open-source project that attempts to provide meaningful info about achievements in games on Steam. This consists of not-only static data about games/achievements, but also user-specific data, relating to friends, playtime, locked/unlocked achievements, etc.

## Domain Knowledge

### Structure

Steam Vault leverages SvelteKit & Svelte 5 for the "web" portion of the project, and a minimal TypeScript exclusively for scheduled tasks. Both parts are tied together by a shared library package that contains the core logic and data structures.

This repository is a monorepo that contains the following packages:

- `@project/lib`: The core library
- `@project/site`: The web application
- `@project/worker`: The worker that runs scheduled tasks

### Production

Everything is currently hosted on Cloudflare Pages & Workers. Storage solutions include Cloudflare KV and D1 (sqlite).

## Coding Standards

This project uses biomejs for linting and formatting in JS/TS, and Prettier for Svelte files.

Node 23 is used, so the newest JavaScript features are available.

## Preferences

When writing code, please keep readability in mind. Avoid removing helpful comments, or ensure that they are replaced with equally helpful comments. Use descriptive variable and function names, and avoid abbreviations unless they are well-known in the context of the project.

Other nitpicks:

- Prioritize early returns in functions.
- Avoid using `any` type whenever possible
  - Include an appropriate `// @ts-expect-error` comment
- Avoid using `as` or `!` type assertions
  - Use `satisfies` keyword when applicable
  - Use `throw new Error()` for type narrowing
