---
applyTo: "**"
---

Coding standards, domain knowledge, and preferences that AI should follow.

# Project Overview

Steam Vault is an open-source project that attempts to provide meaningful info about achievements in games on Steam. This consists of not-only static data about games/achievements, but also user-specific data, relating to friends, playtime, locked/unlocked achievements, etc.

## Domain Knowledge

### Structure

Steam Vault leverages SvelteKit & Svelte 5 for the "web" portion of the project, and a minimal "worker" exclusively for scheduled tasks. Both parts are tied together by a shared library package that contains the core logic and data structures.

This repository is a monorepo that contains the following packages:

- `@project/lib`: The core library
- `@project/site`: The web application
- `@project/worker`: The worker that runs scheduled tasks

### Production

Everything is currently hosted on Cloudflare Pages & Workers. Storage solutions include Cloudflare KV and D1 (sqlite).

## Coding Standards

This project uses BiomeJS for linting and formatting in JS/TS, and Prettier for Svelte files.

### Considerations

Resources are **extremely** limited in this project, so the utmost care must be taken when dealing with unknown quantities of data inside of core logic.

### Node 23

This project uses Node 23 in the backend. The features listed below are available in Node 23 & _all_ modern browsers, and are _safe_ to use anywhere in the codebase.

#### Iterables

`Array.from` and similar methods should be **avoided** whenever possible. Node 23 provides [its own set of helper methods](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Iterator#iterator_helper_methods) that prevent the need to copy sets & maps to-and-from arrays.

Prefer `Iterable.prototype.toArray()`, but almost all code accepts iterables directly. For example:

```ts
const mySet = new Set([1, 2, 3]);
for (const item of mySet.values().map((a) => a + 1)) {
	console.log(item);
}
```

Remember that using iterables can seriously improve performance.

#### Sets

Node 23 provides a [set composition methods](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set#set_composition). Use these instead of manually iterating over sets to create unions, intersections, etc.

```ts
const difference = mySet1.difference(mySet2);
```

### Drizzle-ORM

Drizzle has [extensive documentation](https://orm.drizzle.team/llms.txt) of which you should make use of. There are many useful examples/use-cases you aren't aware of.

#### `sql` Operator

The [`sql` operator](https://orm.drizzle.team/docs/sql) is a function should be reserved for _very specific_ cases. It bypasses all helper-logic, and is considered unsafe. When considering `sql`, _always_ do the following:

- Check if Drizzle has a built-in function
- Check our existing [Drizzle utils](/packages/lib/src/repositories/sqlite/utils.ts)
- Can we effectively genericize an output type? If so, can we _add_ a helper function?
- Otherwise, we can use `sql`

#### `as` Method

It's not documented well, but you can use the `.as` method to create type-safe aliases for your queries (even the `sql` operator!). Any raw usage of `AS <alias>` in SQL is considered unsafe.

#### Composition

Drizzle supports [query composition](https://orm.drizzle.team/docs/dynamic-query-building). The crux of our codebase is leveraging this to build complex queries from simpler ones. We do this to avoid shovelling results from one query to another.

Our database is limited to 100 parameters per query. This can be bypassed **only** by batching multiple requests, however this should be avoided at **all costs** because it is almost always unnecessary. That means:

- No parameter exploding
- No chaining queries

**I am dead serious about this. Do not even dream about anything but composition. Any code that has parameter explosion is immediately useless.**

We have several implementations & interfaces using these patterns. You can reference [the repository folder](/packages/lib/src/repositories/sqlite/) for examples.

#### Chunking & `inArray` Operator

`inArray` is the source of all evil, for the above reasons. `inArray` Should only exist at a top-level function/builder (e.g. a class using its own properties is fine). Chunking goes hand-in-hand with this; avoid it entirely. Do not attempt to chunk data as a solution to any problem.

#### Batching

Batching should only be used for insertions & running separate queries concurrently.

## Package Scripts

- `npm run format` - Formats the codebase
- `npm run check` - Runs type checking and linting
- `npm test` - Runs the test suite.
- `npm run db:migration` - Creates a database migration in the [Drizzle folder](/packages/lib//drizzle/)
- `npm run db:migrate` - Applies database migrations

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
