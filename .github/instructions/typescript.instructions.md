---
applyTo: "**/*.ts"
description: Instructions for working with TypeScript in this project.
---

## Node 23

This project uses Node 23 in the backend. The features listed below are available in Node 23 & _all_ modern browsers, and are _safe_ to use anywhere in the codebase.

### Iterables

`Array.from` and similar methods should be **avoided** whenever possible. Node 23 provides [its own set of helper methods](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Iterator#iterator_helper_methods) that prevent the need to copy sets & maps to-and-from arrays.

Prefer `Iterable.prototype.toArray()`, but almost all code accepts iterables directly. For example:

```ts
const mySet = new Set([1, 2, 3]);
for (const item of mySet.values().map((a) => a + 1)) {
	console.log(item);
}
```

Remember that using iterables can seriously improve performance.

### Sets

Node 23 provides a [set composition methods](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set#set_composition). Use these instead of manually iterating over sets to create unions, intersections, etc.

```ts
const difference = mySet1.difference(mySet2);
```
