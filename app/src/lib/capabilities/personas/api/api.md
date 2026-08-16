# Personas API

Lives at `api/api.md`.

| Directory | Function | Kind |
| --- | --- | --- |
| [`list/`](list/list.md) | `list` | query — the personas this project may work with |
| [`create/`](create/create.md) | `create` | mutation — defines one |
| [`revise/`](revise/revise.md) | `revise` | mutation — replaces one |
| [`shared/`](shared/shared.md) | — | `requirePersona`, which this capability and persona threads both start with |

## `revise` replaces rather than patches

A persona has no partial edit. Its parts are a name, five sections, a scope, a
binding, and a tool list, and **clearing** any of them is how a persona gets
simpler — so a patch would have to say what an absent field means, and either
answer ("unchanged", "cleared") is wrong half the time.

## Nothing here renders a prompt

[`renderPersonaPrompt`](../types/prompt.ts) is in `types/`, because its callers
are whatever runs a persona rather than a client. `api/` is the list of functions
an untrusted caller can reach, and "turn this definition into text" is not one of
them.

## Every mutation writes an activity entry

Inside the same transaction, by calling
[`record`](../../activity/api/shared/shared.md). An entry cannot be missing from
a write that happened or present for one that did not.
