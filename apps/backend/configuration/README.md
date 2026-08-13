# Configuration

[`createConfiguration()`](../src/capabilities/platform/configuration/runtime-objects/configuration/constructor.ts)
reads this directory once during backend startup and returns an immutable
configuration snapshot.

## API

```ts
interface Configuration {
  get(key: string): unknown;
}
```

Keys are dot paths such as `server.port`. A missing or malformed path returns
`undefined`. Configuration does not provide defaults, coerce values, validate
their shape, reload files, or make type assertions. Each consumer validates the
keys it uses.

## Sources and precedence

Every `*.yaml` file is read as UTF-8 and translated with the YAML parser.
Ordinary section files are merged in lexicographic filename order.
`local.yaml`, when present, is merged last, so it overrides every ordinary
section file.

At a matching key, two plain objects merge recursively. Every other overlay
value—including an array—replaces the existing value completely. A file whose
root YAML value is not a mapping stops startup with a configuration error.

The completed tree is recursively frozen before the snapshot is returned.
Further mutation cannot change values returned by `get()`.

## Current consumers

- [`main.ts`](../src/main.ts) validates `server.host` and `server.port`.
- [`observability.ts`](../src/capabilities/platform/observability/runtime-objects/observability/constructor.ts)
  validates `logging.enabled`, then validates `logging.level` when logging is
  enabled.

See [the configuration procedure](configuration.md) for
the complete reading, merge, and lookup tree.
