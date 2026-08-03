# Persona concepts

## Purpose

A persona is a reusable, named answer to "how should this work be done?" It is authored
by a person, stored in a project-scoped catalog, and frozen into a task before that task
makes its first model call.

## Vocabulary

| Term | Meaning in the implementation |
|---|---|
| Section | One named free-text field of a definition. There are exactly five. |
| Definition | The five sections plus the optional context reference. The whole of what a persona means. |
| Record | A named, mutable, revisioned persona in the catalog. |
| Snapshot | The immutable value a consumer pins into a task. Carries the rendered prompt. |
| Freeze | The single moment a consumer resolves a persona to a snapshot — once per task, before the first model call. |
| Fold in | A consumer selecting which sections apply to the kind of work it does. |
| Private wrapper | Persona's own Context record, one per persona carrying a context reference. |
| Logical deletion | Remove the Persona and its wrapper from current storage while retaining revision history. |
| Purge | Irreversibly remove retained Persona history and the owned wrapper's history. |

## The five sections

Each maps to exactly one question, and no two answer the same one.

| Section | Question it answers |
| --- | --- |
| `focus` | What is this about? |
| `background` | What do you already know? |
| `approach` | How should you work? |
| `outputPreferences` | What comes out? |
| `verification` | When are you done? |

The names are chosen to be typed into a form by a person, not assembled by a program.
`background` is split out from behaviour because standing facts and working method are
different things, and authors conflate them when given one box.

### `background` is not the context reference

Easy to confuse, and the distinction should appear in any authoring UI:

- `background` is **short inline knowledge that is always in the prompt**. It costs
  tokens on every call and is never retrieved. Use it for durable facts: who we are,
  what the domain is, what conventions hold.
- `context` is **retrievable source material**. It is never rendered into the prompt. It
  widens what the task can find, and costs nothing until retrieved.

A persona that pastes a document into `background` is misusing it. A persona that puts a
one-line standing fact behind a retrieval hop is also misusing it.

### Empty sections

A section left empty is omitted entirely, heading included. A definition must carry
*something*: at least one non-empty section, or a context reference. Five empty sections
and no context is rejected at ingress, because it means nothing and renders to nothing.

Five empty sections *with* a context reference is legal. It is a pure scope persona, it
renders to an empty string, and "work against this material" is a real persona even with
no behavioural text. **Consumers must therefore tolerate an empty `prompt` and omit the
message rather than sending a blank system turn.**

## The private wrapper

Whatever `ContextEntry` an author supplies, Persona wraps it in a Context record of its
own, named `persona:<personaId>` and created with `private: true`.

```text
author supplies { id: "ctx-a", kind: "context" }
        │
persona.create
        │  context.declare("persona:<id>", [entry], { private: true })
        ▼
record.definition.context   = { id: "ctx-a", … }     ← as authored, round-trips on read
record.contextWrapperId     = "<wrapper id>"          ← Persona's bookkeeping
        │
persona.resolve
        ▼
snapshot.context = { id: "<wrapper id>", kind: "context" }
```

The wrapper name is derived from the persona's **immutable id**, never its editable
display name, so a rename can never orphan or collide it. Since the id is a fresh UUID,
the name cannot collide with another persona's wrapper or an author's own context.

`private: true` keeps it out of `GET /contexts` by default, so the catalog is not filled
with per-persona scaffolding.

Today the wrapper holds exactly one entry — the author's, unmodified — so it is a
**named, private alias**, not a copy. It adds a hop, not a guarantee: if the underlying
entry is deleted, the wrapper still resolves but contributes nothing. A real snapshot
(expanding `context.resolve()` at wrap time and freezing the leaves) is a natural next
step and is deferred.

Persona never calls `context.get`, `context.resolve`, `context.combine`, or
`context.list`. Expanding a reference into retrievable content is the consumer's job.

## Composing a scope to hand to Persona

Set algebra happens **before** Persona sees anything. A caller shapes what it wants using
Context's own endpoints and passes the result in:

```text
POST /contexts/difference
  { a: { entries: [{ id: "*", kind: "project" }] },   // the whole project, named explicitly
    b: { contextId: "ctx-x" },                        // minus this
    displayName, description? }
  → a named, listable context record: the left operand becomes its `entries`, the
    right becomes its `excludes`, subtracted at resolve time
  → persona.definition.context = { id: thatRecord.id, kind: "context" }
```

That record stores the operation, not its result. `{ id: "*", kind: "project" }` expands to
whatever the project holds at the moment a consumer resolves it, so "the whole project
except `ctx-x`" keeps meaning that as sources are added.

This is why a persona carries **one** entry rather than a list. A `ContextEntry[]` is
union-only by construction: a list can only mean "all of these". It cannot represent "the
whole project except this part", because the exclusion is a field on a Context *record*
(`excludes`) and there is nowhere in a bare entry list to put it. A single reference to an
already-composed context reaches that record and is a smaller field.

`kind` is not constrained to `"context"`. A persona may reference a document, the project
itself, or any other resource kind directly. `project` is the one kind that is not opaque:
it expands to the project's live membership rather than naming a resource.

## The fragment is appended, never substituted

The load-bearing rule of the whole capability.

**A persona is appended to the consumer's own system content. It never precedes it and
never replaces it.** The consumer's tool contracts, output schema, and safety rules stay
first and non-negotiable; persona text is advisory guidance underneath them.

An author editing a persona must not be able to dissolve a task's contract. Persona
returns a *fragment* specifically so that no consumer is tempted to treat it as a whole
system prompt.

## The built-in default

`builtin:default` is a code constant at revision 0. Not a table row, not editable, not
deletable, and always resolvable — including against an empty database. Its purpose is
to make consumers total without requiring a seeded row or a migration.

Its definition is a neutral baseline: address what was asked, work from evidence in
scope, say plainly when the evidence does not support an answer, prefer direct prose over
hedging, and check claims against the material before presenting them as settled. It
carries no context reference and no `background`.

Resolving a *deleted or unknown* id throws rather than falling back to the built-in — a
consumer never silently gets different behaviour than the one it named.

## Current and history lifecycle

The typed Persona table contains exactly the live catalog. An accepted update archives
the previous complete record and replaces it with revision `N + 1`. Logical deletion
deletes the owned private Context wrapper, archives the final Persona record, appends a
terminal deletion revision, and removes the Persona current row. Consequently a deleted
Persona has no catalog, get, resolve, or name-uniqueness presence; it exists only in
retained history.

Physical purge removes both retained Persona history and the wrapper's retained Context
history. The built-in remains outside this lifecycle. Retained snapshots are for
inspection, not history-to-current replay; the backend-wide policy prunes old live
snapshots and purges terminal deletions after the configured cutoff.
