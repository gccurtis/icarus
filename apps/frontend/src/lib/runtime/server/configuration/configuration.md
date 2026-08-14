# Configuration

One immutable snapshot of `configuration/*.yaml`, read once at startup.

Sections merge in lexicographic order; optional `local.yaml` merges last, which
is what makes it the place for a real API key without touching a tracked file.
Nested mappings merge; arrays and scalars replace, so a configured list is the
list rather than an append to a default.

## One method

```ts
interface Configuration {
  get(key: string): unknown;
}
```

`get` takes a dot path and returns `unknown`. A missing key, an empty segment,
and a path running through a non-mapping are all the same answer: `undefined`.

The interface is this small on purpose. Typed getters, schemas, and defaults
would put every consumer's expectations in one place, and the only thing that
knows whether `logging.level` may be absent is the code that reads it. So each
consumer validates the keys it uses, and `requiredString` exists only because
"non-empty string" is the shape nearly every key has and eight copies of that
check would drift.

## The snapshot is frozen

Configuration is read by everything and owned by nobody, so a consumer that
mutated what it read would change what every later reader sees — a bug that
surfaces far from its cause. Freezing turns that into a throw at the write.

## Where the directory is

Resolved from the process working directory, deliberately **not** from this
module's own location. Under Vite this file is bundled into a chunk under
`build/server/`, so `import.meta.url` would resolve to a directory that exists
and is wrong — producing an empty configuration rather than an error. The
backend derived it that way, and it was one of three path derivations this
migration had to repair.
