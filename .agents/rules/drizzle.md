# Drizzle And D1 Rules

## Query Composition Is A Hard Constraint

D1 has a low bound-variable limit, and this project often works with user, game, friend, and achievement sets whose size is not known ahead of time.

Do not solve this by:

- Chunking arrays into repeated `inArray(...)` read queries.
- Fetching IDs in one query and feeding them into another unbounded query.
- Adding manual batching for reads.

Those approaches have repeatedly caused worse correctness, latency, and limit behavior in this codebase.

Instead:

- Compose Drizzle queries so filtering happens inside the database.
- Use repository builders, subqueries, and helpers from `packages/lib/src/repositories/sqlite`.
- Add a reusable query helper when the shape appears in more than one place.
- Use batching only for inserts or genuinely independent operations.

## Raw SQL

Reserve Drizzle's `sql` operator for cases where typed helpers and local utilities cannot express the query.

Before using `sql`:

- Check Drizzle built-ins.
- Check `packages/lib/src/repositories/sqlite/utils.ts`.
- Check whether a small reusable helper would preserve typing.

Use `.as()` for aliases instead of raw `AS <alias>` fragments.

## `inArray`

Treat `inArray` as risky when the input size can grow with users, friends, apps, or achievements. It may be acceptable at a top-level builder with known bounds, but it should not be introduced as a generic filtering shortcut.
