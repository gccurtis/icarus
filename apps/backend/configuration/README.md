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

## Consumers

Each consumer validates the keys it reads and documents them. One `*.yaml` file
per capability, named for it, keeps that easy to follow from either direction.

See [the configuration procedure](configuration.md) for
the complete reading, merge, and lookup tree.
