# Derived Outputs API

Lives at `api/api.md`.

| Directory | Function | Kind |
| --- | --- | --- |
| [`list/`](list/list.md) | `list` | query — the project's outputs, without their content |
| [`read/`](read/read.md) | `read` | query — one output whole |
| [`create/`](create/create.md) | `create` | mutation — declares one |
| [`refresh/`](refresh/refresh.md) | `refresh` | mutation — asks for a generation |
| [`shared/`](shared/shared.md) | — | `requireOutput`, the staleness comparison, and the two procedures that record a generation's outcome |

## Declaring and generating are separate functions

`create` writes a declaration and stops. Asking for content is `refresh`, and
what actually generates is neither: a model call cannot run inside a mutation.

Keeping them apart is what lets an output be declared inside a document edit —
somebody types a prompt block into a paragraph and the transaction commits
without waiting on a provider.

## `refresh` returns a request rather than a result

It marks the output `generating`, returns the prompt, the scope, the declared
inputs, and the presented copy to shape by, and the caller runs the generation.
The outcome comes back through
[`completeGeneration` or `failGeneration`](shared/shared.md), which are not
registered anywhere.

That split is also the reason nothing here is an action: this capability owns the
record of a generation, not the generation.

## Both reads fold the state

`stale` is a comparison between `inputsAt` and the same reading taken now, so it
is computed where it is needed rather than stored. `list` pays for it too — a
directory of generated content whose staleness marker is wrong for exactly the
outputs it matters for would be worse than none.

## Only `create` writes an activity entry

Declaring generated content is an editorial act and belongs in the log. A refresh
is a button or a change signal, and a feed of "regenerated, regenerated,
regenerated" would bury everything a person would want to read there — which is
the same reason [`submit`](../../revisions/api/submit/submit.md) records nothing
for a keystroke batch.
