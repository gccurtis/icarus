# Configuration procedure

## API

```ts
export interface Configuration {
  get(key: string): unknown;
}

export const createConfiguration = async (): Promise<Configuration> => {
  // read, translate, and freeze the configuration snapshot
};
```

`get()` accepts a dot-separated key such as `server.port` and returns the
stored value as `unknown`. It returns `undefined` when the key does not
exist. It does not apply defaults, validate values, coerce strings, read files
again, or perform caller type assertions.

## File tree

```text
apps/backend/
├─ configuration/                              YAML input files
│  ├─ <capability>.yaml                         one per capability, all read
│  ├─ local.yaml                                optional; merged last
│  └─ configuration.md                          this procedure
│
└─ src/capabilities/platform/configuration/    createConfiguration()
```

There is no default-value module, schema module, per-capability configuration
parser, or configuration wrapper. The
[capability](../src/capabilities/platform/configuration/overview.md) owns file
reading, YAML translation, merging, snapshot freezing, and lookup.

## Construction tree

- [`createConfiguration()`](../src/capabilities/platform/configuration/runtime-objects/configuration/constructor.ts)
  - locates [`configuration/`](README.md) through the
    `#configuration/*` package alias
  - reads directory entries
  - keeps files whose names end in `.yaml`
  - sorts their names lexicographically for deterministic order
  - separates `local.yaml` from the ordinary section files
  - for each ordinary section file, in sorted order
    - reads its UTF-8 text
    - translates YAML text to a JavaScript value
    - requires the result to be a plain object
    - merges it into the accumulated plain-object tree
  - if `local.yaml` exists
    - reads and translates it using the same rules
    - merges it last, so its values override every section file
  - recursively freezes the resulting tree
  - returns one `Configuration` snapshot

## Translation and merge tree

```text
YAML text
│
├─ translate with the YAML parser
│
├─ result is not a plain object
│  └─ throw a configuration error identifying the source file
│
└─ result is a plain object
   └─ merge(base, overlay)
      │
      ├─ both values at a key are plain objects
      │  └─ recursively merge their keys
      │
      └─ otherwise
         └─ overlay replaces base
            (arrays are replaced as complete values, never concatenated)
```

For example:

```yaml
# server.yaml
server:
  host: 127.0.0.1
  port: 4000
```

```yaml
# local.yaml
server:
  port: 4010
```

produces this snapshot:

```ts
{
  server: {
    host: "127.0.0.1",
    port: 4010
  }
}
```

## Lookup tree

```text
configuration.get("server.port")
│
├─ split key on "." → ["server", "port"]
├─ start at the frozen root object
├─ for each segment
│  ├─ current value is a plain object with that own key → descend
│  └─ otherwise → return undefined
└─ return the final value as unknown
```

A key is a lookup path, not an expression language:

- `get("server.port")` returns the value at that path.
- `get("server")` returns the whole frozen `server` object as `unknown`.
- `get("")`, `get(".server")`, and `get("server.")` return
  `undefined`.
- Prototype properties are never considered; only own object keys may match.

## Consumer boundary

The configuration object deliberately does no schema validation. Each consumer
owns the requirements for the keys it reads:

```ts
const rawPort = configuration.get("server.port");
if (typeof rawPort !== "number" || !Number.isInteger(rawPort)) {
  throw new Error("server.port must be an integer");
}
```

Which keys exist, and what each must be, belongs to the consumer that reads them
and is documented there. Listing them here would put every capability's
requirements in a file that has no way to notice when one of them changes.
