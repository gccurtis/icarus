# Personas

A reusable configuration for how an agent behaves — its instructions, its model,
and what it is allowed to touch. A persona is an *identity*: it is mentioned,
chatted with, and attributed.

## Public Surface

| Function | Kind | Answers |
| --- | --- | --- |
| `list` | query | the personas this project may work with |
| `create` | mutation | defines one in this project, returning its id |
| `revise` | mutation | replaces one, against the revision the author read |

Registered in
[`src/convex/capabilities/personas.ts`](../../../convex/capabilities/personas.ts),
all three built from `projectQuery` / `projectMutation`.

There is no `remove`. A persona is pointed at by every chat and every task that
ever ran under it, and those references are not copies — so deleting one has to
decide what those become, and that decision waits until
[agent tasks](../../../../../docs/data-models/ai/agent-task.md) exist.

## Data Ownership

| Stored | Purpose |
| ------ | ------- |
| `personas` | one row per persona: how it behaves, what it may call, and what it brings with it |

## A reference, not a copy — the opposite of a template

A task references a persona by id and does not copy it, so editing a persona
changes what every past task shows.

This is the reverse of
[templates](../templates/overview.md#instantiation-is-a-copy-and-that-is-the-whole-design),
and the difference is what the reference *means*. A template is a starting point
a resource is meant to grow away from, so a copy is the honest record. A persona
is an identity — someone looking at last week's task wants to know who did it,
and a frozen copy of an outdated configuration answers a question nobody asked.

It is also why [`revise`](api/revise/revise.md) carries a stale-form check: an
edit here is visible everywhere at once.

## Five sections, five questions

The definition is not one instructions box. `focus` is what this is about,
`background` what is already known, `approach` how to work, `outputPreferences`
what comes out, `verification` when it is done. No two answer the same question,
and the names are meant to be typed into a form by a person.

**They are plain text.** Each goes to a model as part of a system prompt, so text
is the destination format; blocks would mean serializing back to text on every
use, and the serialization would be what actually determined behaviour while the
blocks pretended to.

## `background` is not `scope`

The distinction is easy to lose, and losing it is expensive in both directions:

- **`background`** is short inline knowledge that is **always in the prompt**. It
  costs tokens on every call and is never retrieved. Durable facts: who we are,
  what the domain is, what conventions hold.
- **`scope`** is a set expression naming **retrievable** material. It is never
  rendered into the prompt. It widens what the work can find, and costs nothing
  until something retrieves it.

A persona that pastes a document into `background` is misusing it. A persona that
puts a one-line standing fact behind a retrieval hop is also misusing it.

## An empty prompt is a persona, not a mistake

Five empty sections **with a scope** is legal, and renders to an empty string:
"work against this material" is a real persona with no behavioural text. So
[`personaSystemMessages`](types/prompt.ts) returns a list — none, or one — and a
consumer omits the system message by having none to send rather than by
remembering to check.

Five empty sections with no scope is refused. An empty *section* is omitted
entirely, heading included, because an empty heading reads as an instruction to
fill it in.

## `projectId` is optional, and still leads the index

Absent means available to every project — the same reading
[templates](../templates/overview.md#projectid-is-optional-and-still-leads-the-index)
takes, and settled there rather than twice. A missing field indexes as
`undefined` and sorts before every id, so the globals occupy their own key range:
`eq("projectId", undefined)` is exactly them, `eq("projectId", mine)` is exactly
mine, and neither range can reach another project's rows.

**Nothing in this surface can make a global one.** `create` always stamps the
caller's project, because publishing to every project from inside one would let
any member put a row in everyone else's list.

## Capability Invariants

- **A refusal is "not found", never "forbidden"** for a persona in another
  project. A global refused for editing is "not editable" instead, because it is
  in the list the caller just read.
- **Attribution is built from the scope**, never accepted as an argument.
- **`tools` is a flat list of names.** Not grants with scopes, conditions, and
  expiry: a permission model elaborate enough to be interesting is elaborate
  enough to be got wrong, and the enforcement point is the tool implementation
  regardless. Absence from the list is the whole restriction, and an empty list
  is a persona that can only read and write.
- **`modelBinding` names a binding, never a model.** Model identifiers change on
  someone else's schedule; a persona should not need editing because a provider
  deprecated a version. Absent uses the deployment default.
- **A definition carries something** — a non-empty section or a scope.
- **Every refusal is thrown as `PersonasError`.** Convex serializes a
  `ConvexError`'s payload and redacts everything else, so a refusal thrown as a
  plain `Error` arrives as a server fault and stops being a refusal.

## Deferred to later passes

| Today | When | Becomes |
| --- | --- | --- |
| `scope` carries a set expression nothing resolves | pass 6 | `resourceSets` resolves it, and `{ op: "set" }` tightens to `v.id("resourceSets")` |
| nothing runs a persona | pass 7 | an agent task references one and renders its prompt |
| a global persona can only be seeded | — | there is no project-scoped path that should be able to write one |

## Related

[persona](../../../../../docs/data-models/ai/persona.md) — the model this
implements ·
[persona threads](../persona-threads/overview.md) — chatting with one ·
[intelligence](../../../../../docs/processes/intelligence.md) — what a model
binding resolves to
