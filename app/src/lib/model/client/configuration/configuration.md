# Configuration

The client configuration model is the first complete pure-islands model slice.
It owns the numeric configuration admitted for one client workspace without
attaching behavior to state or exposing lifecycle authority to consumers.

The interactive source reference is served at
[`/demo/pure-functions/configuration`](/demo/pure-functions/configuration).

## Contract

| Surface | Owner | Contents |
| --- | --- | --- |
| `ClientConfigurationInput` | server-to-client boundary | One exact nested record containing 13 required finite numbers |
| `ConfigurationState` | model | Thirteen flat readonly numeric fields and no behavior |
| `ConfigurationAdapter` | runtime | `lifetime`, `commitMode`, `acquire`, `release`, and `close` |
| `AcquiredConfigurationPort` | one runtime acquisition | `getNumber` plus `commit`; no adapter lifecycle members or raw state |

## Ownership and lifetime

- One `ConfigurationState` is constructed for each client graph.
- `runtime/client/models/build.ts` is the only production caller of
  `createConfigurationState` and `bindConfiguration`.
- The adapter has `client-workspace` lifetime and is retained until
  `ClientModel.close()`.
- Each `acquire(undefined)` returns a distinct frozen facade backed by its own
  lease. `release(port)` invalidates only that lease.
- `close()` invalidates all remaining leases and refuses later acquisition.

The model is read-only. Its required `commit()` checks that its lease remains
open and is otherwise a documented no-op.

## State

`state.ts` copies every nested input leaf into a flat primitive field. It never
retains the caller's transport object, a callback, a promise, a handle, an
accessor, or another model.

The model does not support a generic string path. `ConfigurationNumberKey` is a
closed union of the 13 published numeric keys, so a missing or newly introduced
setting must be made explicit at the server admission, input, state, selector,
runtime translation, and tests.

## Operations

See [`methods/methods.md`](methods/methods.md) for the complete call tree.

```ts
getNumber(state: ConfigurationState, key: ConfigurationNumberKey): number
selectNumber(state: ConfigurationState, key: ConfigurationNumberKey): number
```

Both functions are synchronous and authority-pure. They receive state first,
import only model-local state and types, and cannot acquire an adapter or discover
ambient authority. `getNumber` is the public operation; `selectNumber` is its
exhaustive supporting decision.

## Port binding

`bindConfiguration(state)` closes over singleton state at the runtime boundary.
It tracks facade provenance in a local `WeakMap` and live leases in a local
`Set`, so no lifecycle state exists at module scope or leaks onto the facade.

The acquired wrapper first checks its own lease and then delegates exactly once:

```ts
getNumber: (key) => {
  assertOpen(lease);
  return getNumber(state, key);
}
```

This closure check means an extracted `getNumber` function cannot be called after
release or adapter close. Forged and foreign facades are refused; release is
idempotent only for a valid facade created by that adapter.

## Runtime transformation

`runtime/client/models/build.ts` performs the complete composition sequence:

1. Construct owned state from admitted input.
2. Bind the singleton state to the runtime-only adapter.
3. Acquire one read lease inside `try/finally`.
4. Read the 13 closed keys and translate them into revision, presentation-stage,
   and workspace threshold records owned by downstream models.
5. Build the client graph, call the read-only `commit()`, and release in
   `finally` on both success and failure.
6. Close the adapter after dependent client models during graph teardown.

No downstream model receives `ConfigurationState`, `ConfigurationAdapter`, or a
generic configuration bag.

## Server admission

[`src/routes/app/[project]/+layout.server.ts`](../../../../routes/app/%5Bproject%5D/+layout.server.ts)
constructs the transport as an explicit object literal and admits each leaf with
`requiredPublishedNumber`. Missing, non-number, `NaN`, and infinite values fail
before browser serialization. The allowlist cannot include provider credentials,
observability settings, or a newly added YAML sibling by omission.

## Invariants

- State is fields only; methods are free functions with explicit state.
- Every acquisition is a fresh, exact, frozen facade.
- Acquired ports expose operations and `commit`, never `acquire`, `release`,
  `close`, the adapter, or raw state.
- Port operations remain usable only while their own lease is open.
- Construction and binding occur once and only in runtime.
- Reads are deterministic and contain no clock, randomness, framework context,
  storage, browser API, or external library authority.

## File tree

```text
configuration/
├── configuration.md
├── index.ts                 # type-only public entry
├── port.ts                  # adapter, acquired port, and binding
├── state.ts                 # stored fields and state constructor
├── types.ts                 # exact input and closed key vocabulary
├── methods/
│   ├── methods.md
│   └── get-number/
│       ├── get-number.ts
│       └── select-number.ts
└── test/unit/
    ├── get-number.test.ts
    └── port.test.ts
```
