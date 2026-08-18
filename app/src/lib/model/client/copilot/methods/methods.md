# Copilot Methods

Lives at `methods/methods.md`.

`methods/` holds the execution behind the public surface. Fourteen methods, in
four groups, and every one is a free function taking `CopilotState` first.

## Methods

| Method | Shape | Location | Effect | Description |
| ------ | ----- | -------- | ------ | ----------- |
| `setMode` | file | [`set-mode.ts`](set-mode.ts) | mutator | How the next message is treated |
| `write` | file | [`write.ts`](write.ts) | mutator | The composer text |
| `selectPersona` | file | [`select-persona.ts`](select-persona.ts) | mutator | Who answers a new conversation |
| `address` | file | [`address.ts`](address.ts) | mutator | Where the next message goes |
| `include` | file | [`include.ts`](include.ts) | mutator | Add to what the response may draw on |
| `exclude` | file | [`exclude.ts`](exclude.ts) | mutator | State that something must not be used |
| `dropSelector` | file | [`drop-selector.ts`](drop-selector.ts) | mutator | Say nothing about it either way |
| `clearScope` | file | [`clear-scope.ts`](clear-scope.ts) | mutator | Say nothing at all |
| `attach` | file | [`attach.ts`](attach.ts) | mutator | Add what this turn carries |
| `detach` | file | [`detach.ts`](detach.ts) | mutator | Remove one |
| `clearAttachments` | file | [`clear-attachments.ts`](clear-attachments.ts) | mutator | Remove all |
| `blocked` | file | [`blocked.ts`](blocked.ts) | accessor | Why the message cannot be sent |
| `sent` | file | [`sent.ts`](sent.ts) | mutator | Record that a message landed |
| `focus` | file | [`focus.ts`](focus.ts) | mutator | Ask the dock to take focus |

## Shape

Every one is a file. None owns supporting flow — the two identity rules they
share are in `shared/`, and normalization belongs to `$shared` rather than here.

## State Access

`CopilotState` as the first argument, imported as a **type** from
[`definition.svelte.ts`](../definition.svelte.ts), which is what keeps the
definition's import of these files from being a runtime cycle.

## Shared Methods

Two, both identity rules — see [`shared/shared.md`](shared/shared.md).

| File | Callers | Invariant |
| --- | --- | --- |
| `same-selector.ts` | `include`, `exclude`, `drop-selector` | A selector is in one list, the other, or neither |
| `same-attachment.ts` | `attach`, `detach` | One attachment per thing pointed at |

## Three scope writers, not two

`include` and `exclude` are not enough on their own, and the third is the reason:

| | Means |
| --- | --- |
| `include(x)` | x may be drawn on |
| `exclude(x)` | x must **not** be drawn on |
| `dropSelector(x)` | nothing is said about x |

Those differ the moment a broader selector is present. `project` included with a
document excluded is a real scope; dropping the document instead leaves the
project selector still covering it.

`include` and `exclude` each remove the selector from the *other* list first,
which is what makes "in one, the other, or neither" hold — normalization
resolves a both-lists conflict by dropping the include, so adding one without
clearing the exclude would read as a no-op.

## Normalization is `$shared`'s

Every scope writer calls `normalize` from
[`$shared/types/resource-set-expression`](../../../../capabilities/shared/types/resource-set-expression.ts)
rather than reimplementing the rules. A persona's material, a prompt block's
inputs and this scope are the same question, and a second implementation here
would be a second answer.

## Common Shape

```text
1. Compute the next whole value — a new expression, a new attachment list
2. Assign it; nothing here mutates in place, because the state is $state.raw
```

## Concurrency

Nothing here is asynchronous and nothing awaits, so no two methods can
interleave. **The model never calls a capability** — `sent` is past tense, and
the surface that sent the message is the one that reports a failure.
