# Shared Name Manager Procedures

Lives at `api/shared/shared.md`.

| File | Preserves |
| --- | --- |
| [`canonical-name.ts`](canonical-name.ts) | that every caller agrees on what a name keys to |
| [`find-variable.ts`](find-variable.ts) | that a name resolves to the same variable whoever asks |
| [`as-variable.ts`](as-variable.ts) | that a stored row leaves this capability as a `NameVariable` |

## `canonicalName`

`define` writes through it and `findVariable` reads through it. Two spellings of
the rule would make `Target Margin` findable from one call site and not from
another — which is a shared invariant rather than merely shared code.

## `findVariable`

Promoted for a caller outside this capability:
[`formula`](../../../formula/api/evaluate/evaluate.ts) resolves a bare name with
it, in the same transaction, and `define` decides a name conflict with it. Those
two agreeing about what `Target Margin` keys to is the point — a formula that
could not find a variable whose name is already taken would be the failure.

It answers `undefined` rather than refusing, because not finding a name is the
ordinary answer to both questions and each caller decides what it means.

## `asVariable`

The storage boundary. `projectId` stops here: a caller only ever receives
variables from the project it asked about, and a public type carrying one invites
reading the project off a value instead of off the caller's own scope.
