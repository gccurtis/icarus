# Configuration Overview

## Description

Configuration is the Platform capability that loads the backend's committed YAML
settings once at startup and serves them as one immutable snapshot.

It provides a single `get(key)` port over the merged sections so that every other
capability reads settings from the same source, at the same moment in the
lifecycle, without reading files of its own.

## Boundary

Configuration owns:

- The set of files that make up a configuration: every `*.yaml` in the
  `#configuration` directory, with `local.yaml` overlaid last.
- Merge order, deep-merge semantics, and the immutability of the loaded snapshot.
- Dot-path key resolution.

Consumers own:

- The meaning of every key. Values leave as `unknown`; the reader decides the
  type it requires and fails on its own terms when a key is missing or wrong.
- Any caching or re-reading. There is no reload: a snapshot is the configuration
  for the lifetime of the runtime that loaded it.

## File Tree

```text
configuration/
├── overview.md
├── index.ts
├── types/
├── runtime-objects/
└── runtime-api/
```

## Dependency Ports

Configuration has no capability dependencies. It is constructed first, before
anything that could log or persist, which is why it reports failure by throwing
rather than by logging.

## Runtime Objects

One instance per backend runtime, constructed by
[`main.ts`](../../../main.ts) during startup.

| Object | Exported | Description | Document |
| ------ | -------- | ----------- | -------- |
| `Configuration` | yes | The frozen snapshot of every merged YAML section. | [configuration.md](runtime-objects/configuration/configuration.md) |

## Public API

| API | Kind | Owner | Description | Document |
| --- | ---- | ----- | ----------- | -------- |
| `get` | runtime method | `Configuration` | Resolves a dot-separated key path to its configured value, or `undefined`. | [get.md](runtime-api/get/get.md) |

## Capability Invariants

- The snapshot is read once. Nothing reloads it, and no method mutates it.
- The snapshot and every mapping inside it are deeply frozen before the runtime
  object is handed to a consumer.
- Sections merge in lexicographic filename order, with `local.yaml` last
  whenever it exists.
- A file that is absent from the directory contributes nothing; a file that is
  present but unparseable fails construction. Startup does not continue on a
  partially loaded configuration.
- Values are returned as `unknown`. Configuration never validates or coerces.
