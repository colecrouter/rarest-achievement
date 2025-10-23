---
applyTo: "**/*.ts"
description: Instructions for working with Drizzle-ORM in this project.
---

# Drizzle-ORM

Drizzle has [extensive documentation](https://orm.drizzle.team/llms.txt) of which you should make use of. There are many useful examples/use-cases you aren't aware of.

## `sql` Operator

The [`sql` operator](https://orm.drizzle.team/docs/sql) is a function should be reserved for _very specific_ cases. It bypasses all helper-logic, and is considered unsafe. When considering `sql`, _always_ do the following:

- Check if Drizzle has a built-in function
- Check our existing [Drizzle utils](/packages/lib/src/repositories/sqlite/utils.ts)
- Can we effectively genericize an output type? If so, can we _add_ a helper function?
- Otherwise, we can use `sql`

## `as` Method

It's not documented well, but you can use the `.as` method to create type-safe aliases for your queries (even the `sql` operator!). Any raw usage of `AS <alias>` in SQL is considered unsafe.

## Composition

Drizzle supports [query composition](https://orm.drizzle.team/docs/dynamic-query-building). The crux of our codebase is leveraging this to build complex queries from simpler ones. We do this to avoid shovelling results from one query to another.

Our database is limited to 100 parameters per query. This can be bypassed **only** by batching multiple requests, however this should be avoided at **all costs** because it is almost always unnecessary. That means:

- No parameter exploding
- No chaining queries

**I am dead serious about this. Do not even dream about anything but composition. Any code that has parameter explosion is immediately useless.**

We have several implementations & interfaces using these patterns. You can reference [the repository folder](/packages/lib/src/repositories/sqlite/) for examples.

## Chunking & `inArray` Operator

`inArray` is the source of all evil, for the above reasons. `inArray` Should only exist at a top-level function/builder (e.g. a class using its own properties is fine). Chunking goes hand-in-hand with this; avoid it entirely. Do not attempt to chunk data as a solution to any problem.

## Batching

Batching should only be used for insertions & running separate queries concurrently.
