# Configuration Types

Lives at `types/types.md`.

`types/` holds the shape of loaded YAML data and the rule that decides what
counts as a mapping. The runtime object's own interface, `Configuration`, is
declared with the class implementing it in
[`runtime-objects/configuration/definition.ts`](../runtime-objects/configuration/definition.ts).

## Files

| File | Holds |
| ---- | ----- |
| `configuration-object.ts` | `ConfigurationObject` and the `isConfigurationObject` guard that narrows to it |

## Private Types

Nothing here is re-exported from `index.ts`. Consumers of Configuration hold the
runtime object and receive `unknown` values; they never handle the loaded tree
directly.

### Type: `ConfigurationObject`

A parsed YAML mapping — the shape of a section file's root, and of every nested
mapping inside it. Values stay `unknown` because Configuration validates
nothing.

```ts
export type ConfigurationObject = Record<string, unknown>;
```

It stays private because it is the loader's working shape. A consumer depending
on it would be depending on YAML being the storage format.

## The Mapping Guard

`isConfigurationObject` sits beside the type it narrows rather than in a
procedure file, because both the loader in
[`constructor.ts`](../runtime-objects/configuration/constructor.ts) and the key
lookup in [`get.ts`](../runtime-api/get/get.ts) must agree on one answer to "is
this a mapping or a value?". Arrays and non-plain objects are values: merging
replaces them wholesale and key traversal stops at them.
