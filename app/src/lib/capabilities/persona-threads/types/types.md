# Persona Thread Types

Lives at `types/types.md`.

| File | Holds |
| --- | --- |
| [`persona-thread.ts`](persona-thread.ts) | `BranchPoint`, `PersonaThread`, `personaThreadTitle` |

## `BranchPoint` stores both halves

The message says where the conversation was cut and the thread says which
conversation. Keeping the thread as well is what lets the earlier turns be read
without first looking the message up to find out where it lived — and it is what
[`requireBranchPoint`](../api/branch/require-branch-point.ts) checks the message
against.

## `PersonaThread` is not the row

It carries `id`, drops `projectId`, and keeps `branchedFrom`, which is how a
reader reaches the conversation before the branch. It adds nothing about the
conversation itself, because turns are `messages.list(("persona", id))`, which
needs nothing from here.

There is no `revision`: a chat has no whole-form replacement to guard, since the
only mutable field is its title and messages are append-only.
