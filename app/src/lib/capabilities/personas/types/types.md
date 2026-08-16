# Persona Types

Lives at `types/types.md`.

| File | Holds |
| --- | --- |
| [`definition.ts`](definition.ts) | `personaDefinitionValidator`, `PersonaDefinition`, `personaSections`, `personaDefinition` |
| [`persona.ts`](persona.ts) | `personaAvatarValidator`, `Persona`, `PersonaDraft`, `personaName`, `personaTools` |
| [`prompt.ts`](prompt.ts) | `renderPersonaPrompt`, `personaSystemMessages` |

## The definition validator is the model

`schema.ts` imports it and so does the deployment door, which makes the column's
five sections and the door's refusal of a sixth the same statement.

## `personaDefinition` states the rule the schema cannot

Five `v.string()` columns say every section may be empty. What they cannot say is
that **all five empty with no scope is nothing at all**, because that is a
constraint between the definition and a field beside it.

The asymmetry is the part worth reading twice: five empty sections **with** a
scope is legal. A pure scope persona is "work against this material" and has no
behavioural text to write.

## The renderer lives here, and it is what consumers call

Rendering is a pure derivation of the model — no context, no storage — and its
callers are outside this capability, so it belongs beside the model rather than
under `api/`, which is the list of functions a *client* can reach.

[`personaSystemMessages`](prompt.ts) returns a list rather than a possibly-empty
string so that omitting the message is structural. A consumer cannot send a blank
system turn, because on a pure scope persona there is nothing handed to it.

## `Persona` is not the row

It carries `id`, replaces `projectId` with `global`, and keeps `revision` — a
client cannot send back a revision it was never given. The definition comes with
it, unlike a template's body: five short sections is the whole of it, and an
editor opened from a list would otherwise need a second read.
