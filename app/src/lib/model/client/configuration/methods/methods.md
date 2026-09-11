# Configuration Methods

Lives at `methods/methods.md`.

`methods/` is the model's authority-pure operation island. The acquired port
delegates to its entry; every function receives state and data explicitly.

## Methods

| Method | Shape | Location | Effect | Description |
| ------ | ----- | -------- | ------ | ----------- |
| `getNumber` | tree | [`get-number/get-number.ts`](get-number/get-number.ts) | read | Selects one member of the closed numeric-key vocabulary |

## Shape

`getNumber` is a small call tree. Its entry owns the public operation while
[`get-number/select-number.ts`](get-number/select-number.ts) maps each closed key
to one stored field. Neither function acquires state or authority.

## State Access

Both functions receive `ConfigurationState` first. No model instance, adapter,
or acquired port is imported into the operation tree.

## Shared Methods

Nothing is shared with another method. There is one public operation.

## Common Shape

```text
1. `getNumber(state, key)` delegates to `selectNumber(state, key)`.
2. `selectNumber` exhaustively maps the 13-key union to primitive state fields.
3. An untyped runtime caller supplying any other key is refused.
```

## Server relationship

The server route owns raw configuration admission and publishes one exact
nested numeric object. The client does not duplicate the server's generic dotted
path traversal; its state constructor copies only that admitted transport shape.

## Concurrency

Nothing here is asynchronous and nothing mutates. Concurrent acquisitions may
read the same immutable singleton state, while release invalidates each facade
independently.
