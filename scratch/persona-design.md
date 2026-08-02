# Persona Capability — Design

> **Status: implemented.** This document has been reconciled with what was built.
> Three shape decisions were changed during implementation, all to follow the
> `comments` capability, which landed after this design was written and is the
> newest precedent for how a capability is built here:
>
> | This design originally said | What was built | Why |
> | --- | --- | --- |
> | Flat shape (files at the capability root, following Structured Data) | **Layered** — `domain/ application/ ports/ persistence/ wire/` | Comments, the newest capability, is layered at a comparable size. Review 001's rule is "layered above a complexity threshold", and a state-carrying capability with a wire decoder is over it. |
> | Seven REST-ish endpoints (`POST /personas`, `GET /personas/entry`, …) | **`POST /personas/command` + `POST /personas/query`** | The newer house shape, used by Document, Slide, Activity, and Comments. |
> | No `wire/` package; validation in the service | **A `wire/` package** with `exactKeys` rejecting unknown fields | Review 001 Tier 3: every new capability adopts the decoder pattern from the start. Closes the `Number(undefined) → NaN → misleading 409` defect by construction. |
> | A synchronous store, matching `DataStore` | **A `Promise`-returning store** | Layered capabilities are async here; flat ones are sync. |
>
> Four smaller deviations, each flagged inline in the section it affects:
>
> | Section | Deviation |
> | --- | --- |
> | Logging | **Three of seven planned events were not built** — `persona.render`, `persona.list`, `persona.get`. Reads are not logged at all. |
> | Ports | The factory is `createPersonaCapability(store, dependencies)` — two arguments, with limits and clock inside `dependencies`. |
> | Ports | An injected `PersonaClock` was added; the original design had none. |
> | Ports | `PersonaContextPort.declare` takes an optional `description` as well as `private`. |
>
> Everything else below — the five sections, rendering rules, digests, the private
> wrapper, the freeze contract, the built-in, the limits, the error table, the
> queue placement, and the non-goals — was built as written, and every test listed
> under Testing exists. The authoritative reference for implemented behaviour is
> now
> [`apps/backend/src/3-capabilities/persona/docs/`](../apps/backend/src/3-capabilities/persona/docs/).

## Intent

Persona is a small, project-scoped, regular capability that owns named
behaviour definitions layered onto agentic tasks. A persona answers five
questions a task needs answered before it starts: what to concentrate on, what
to already know, how to work, what to produce, and when to stop. It may also
carry one reference to reusable source material.

Persona is deliberately not an agent. It holds no task state, makes no model
call, chooses no model, executes no tool, and resolves no scope. It produces
one deterministic block of text plus one optional resource reference, and it
hands both to a consumer that freezes them into its own task.

The first version is deliberately narrow:

- project scope only;
- a catalog of named, revisioned persona records;
- ingress validation and deterministic rendering;
- one immutable snapshot value a consumer pins into a task; and
- one built-in fallback persona so consumers are total.

Library publication, immutable version history, a project default pointer,
persona composition, and templating inside sections are all deferred. Each is
listed under non-goals with the reason.

## Ownership boundary

Persona owns:

- the persona catalog: identity, display name, description, and definition;
- validation and normalization of a definition at ingress;
- deterministic rendering of a definition into one prompt fragment;
- the snapshot value and digests a consumer freezes into a task; and
- the single built-in fallback persona.

Persona does not own:

- model calls, cast selection, or message assembly beyond its own fragment;
- task state, runs, tool policy, or results;
- Context records, Context composition, or scope resolution — except the one
  private wrapper record it creates and manages for itself, below;
- Knowledge sources or retrieval; or
- where in a message list its fragment is placed.

```text
caller supplies a ContextEntry (an existing record, inline entries composed
via Context's own union/difference endpoints, or a direct resource reference)
        │
        ▼
persona.create / persona.update
        │  wraps it: context.declare/update("persona:<id>", [entry], {private:true})
        ▼
persona record { sections, definition.context (as authored),
                  contextWrapperId, contextWrapperRevision }
        │  resolve (freeze)
        ▼
PersonaSnapshot { prompt, context: {id: contextWrapperId, kind:"context"}, digests }
        │
        └──►  consumer task: system messages + scope union
```

Persona still never **expands** its context reference into retrievable
content — that stays the consumer's job via `knowledge.resolveScope(...)`,
exactly as before. What changes from the earlier draft: Persona now owns a
private, single-entry Context record of its own. On `create` and `update` it
declares or updates a wrapper named `persona:<personaId>` that mirrors
whatever entry the author supplied, and it is *that wrapper* — not the
author's original entry — that ends up in `PersonaSnapshot.context`. See
"The private wrapper" below.

This corrects the earlier claim that Persona has "zero runtime dependency on
`ContextManager`." It does now, through one narrow port — see
[Ports](#ports) — but the dependency is scoped to managing that one private
record. Persona still never calls `context.resolve`, `context.combine`, or
`context.list`, and still has zero dependency on Knowledge.

## Terms

- **Section** is one named free-text field of a definition. There are five.
- **Definition** is the five sections plus the optional context reference. It
  is the whole of what a persona means.
- **Record** is a named, mutable, revisioned persona in the catalog.
- **Snapshot** is the immutable value a consumer pins into a task. It contains
  the rendered prompt, so a pinned task is replayable without Persona.
- **Freeze** is the single moment a consumer resolves a persona to a snapshot.
  It happens once per task, before the first model call.
- **Fold in** is a consumer selecting which sections of a persona apply to the
  kind of work it does. A task with no verification step folds in four
  sections, not five.

## The definition

```ts
type PersonaSectionName =
  | "focus"
  | "background"
  | "approach"
  | "outputPreferences"
  | "verification";

interface PersonaDefinition {
  /** What to concentrate on, and what to deliberately leave alone. */
  readonly focus: string;

  /** Standing facts the task should assume without being told. */
  readonly background: string;

  /** How to work: method, rigour, standards, boundaries. */
  readonly approach: string;

  /** What the result should look like: shape, length, formatting, tone. */
  readonly outputPreferences: string;

  /** What to check before presenting the result as finished. */
  readonly verification: string;

  /** Optional reusable material this persona brings with it. */
  readonly context?: ContextEntry;
}
```

Each section maps to exactly one question, and no two sections answer the same
one:

| Section | Question it answers |
| --- | --- |
| `focus` | What is this about? |
| `background` | What do you already know? |
| `approach` | How should you work? |
| `outputPreferences` | What comes out? |
| `verification` | When are you done? |

The names are chosen to be typed into a form by a person, not assembled by a
program. `approach` replaces the earlier `guidance`, which was vague about
guidance *toward what*. `background` is split out from behaviour because
standing facts and working method are different things and authors conflate
them when given one box.

### Background is not the context reference

These are easy to confuse and the distinction should be stated in the authoring
UI as well as here:

- `background` is **short inline knowledge that is always in the prompt**. It
  costs tokens on every call and is never retrieved. Use it for durable facts:
  who we are, what the domain is, what conventions hold.
- `context` is **retrievable source material**. It is never rendered into the
  prompt. It widens what the task can find, and costs nothing until retrieved.

A persona that pastes a document into `background` is misusing it. A persona
that puts a one-line standing fact behind a retrieval hop is also misusing it.

### Empty sections

A section left empty is omitted entirely — heading included.

A definition must carry *something*: at least one non-empty section, or a
context reference. A definition with five empty sections and no context is
rejected at ingress, because it means nothing and renders to nothing.

A definition with five empty sections *and* a context reference is legal. It is
a pure scope persona, it renders to an empty string, and "work against this
material" is a real persona even with no behavioural text. Consumers must
therefore tolerate an empty `prompt` and omit the message rather than sending a
blank system turn.

### The context reference

A persona carries **one** `ContextEntry`, not a list:

```ts
readonly context?: ContextEntry;   // { id, kind } — usually kind: "context"
```

The reason is expressiveness, and it is the central correction to the earlier
draft. A `ContextEntry[]` is union-only *by construction*: a list of entries
can only ever mean "all of these". It cannot represent "the whole project
except this part", because set difference is an operation applied to a list,
not a value expressible within one.

A single reference to an already-composed context solves this and is a smaller
field. The caller does the set algebra up front:

```text
caller picks includes and excludes
  → POST /contexts/difference { a, b, displayName, description? }
  → named, listable context record   (displayName is required and unique)
  → persona.definition.context = { id: thatRecord.id, kind: "context" }
```

`union`/`difference` are already implemented and registered
(`context.ts:198`, `registerContextEndpoints.ts:141,160`). They resolve two
operands (by context ID or inline entries), apply the set operation, and
persist the result under a caller-supplied, unique `displayName`. The
anonymous-`~uuid` shape this section originally described was removed by the
Context migration; every composed context is now a normal, permanently
catalog-visible record. This is a plain read/compose step the *author*
performs while shaping what to hand to Persona — unrelated to the private
wrapper Persona then makes for itself, described next.

`kind` is not constrained to `"context"`. A persona may reference a document or
any other resource kind directly when that is all it needs; the consumer's
`resolveScope` handles every kind uniformly. Constraining the kind would buy
nothing and would block the simple case of "this persona always reads the style
guide."

### The private wrapper

**Persona owns a second, private Context record that it manages itself.**
Whatever `ContextEntry` the author supplies in `definition.context` — an
existing record's id, a direct document reference, whatever — Persona wraps
it in a context record of its own on `create` and keeps that wrapper in sync
on every `update`:

```text
create(input)
  1. validate the definition (unrelated to Context)
  2. generate personaId
  3. if definition.context is present:
       wrapper = context.declare(`persona:${personaId}`, [definition.context],
                                  { private: true })
       → contextWrapperId = wrapper.id, contextWrapperRevision = wrapper.revision
  4. persist the record (definition as authored, plus the wrapper fields)
```

```text
update(input)
  no context before,  no context now        → no-op
  no context before,  context now           → context.declare(same name, {private:true})
  context before,     context still present → context.update(wrapperId, [entry], wrapperRevision)
                                               (same id, new revision — the wholesale
                                                definition replace already in effect
                                                covers both "changed" and "resubmitted
                                                unchanged")
  context before,     no context now        → context.delete(wrapperId); clear wrapper fields
```

```text
delete(input)  →  if a wrapper exists, context.delete(wrapperId), then soft-delete the persona
```

Naming is `persona:<personaId>` — the persona's own immutable `id`, not its
(editable) `displayName`, so a rename can never orphan or collide the
wrapper. Since `personaId` is a fresh UUID, the name can never collide with
another persona's wrapper or an author's own context, and no uniqueness
check beyond Context's existing one is needed.

**`PersonaSnapshot.context` points at the wrapper, not at what the author
typed.** `GET /personas/entry` still returns `definition.context` exactly as
authored — round-tripping what someone typed into a form matters — but
`resolve()` builds the snapshot's `context` field from `contextWrapperId`.
Every consumer described in this document already treats `snapshot.context`
as opaque, so this is invisible downstream; nothing in the Freeze contract or
the Derived Outputs sketch changes.

For now the wrapper always contains exactly one entry — the author's, handed
to `context.declare`/`context.update` unmodified — so it is functionally a
*named, private alias* for the author's entry, not a copy. `resolveScope`
still degrades silently if the underlying entry is later deleted, exactly as
before; wrapping adds a hop, not a guarantee. A real snapshot (walking
`context.resolve()` at wrap time and freezing the expanded leaves into the
wrapper) is a natural next step and is deferred — see Known limitations.

**This requires one change to Context**, worked out in
`scratch/context-persona-update.md`: `declare`/`composeNamed` gain an
optional `private` flag, and `list()` excludes private records by default.
Nothing else about Context changes.

## The record

```ts
interface PersonaRecord {
  readonly id: string;
  readonly displayName: string;      // unique among live records, case-insensitive
  readonly description: string;      // catalog blurb; never rendered, never digested
  readonly definition: PersonaDefinition;

  /**
   * Persona's own private Context record wrapping definition.context.
   * Present iff definition.context is present. Internal bookkeeping only —
   * never exposed in place of definition.context, and excluded from
   * definitionDigest because it lives outside PersonaDefinition.
   */
  readonly contextWrapperId?: string;
  readonly contextWrapperRevision?: number;

  readonly revision: number;         // monotone, starts at 1
  readonly definitionDigest: string; // sha256 over the canonical definition
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly deletedAt?: string;
}
```

`description` is excluded from both the render and the digest. It exists for
catalog pickers and humans. The consequence is deliberate: editing a blurb
bumps `revision` but leaves `definitionDigest` unchanged, so the digest keeps
answering exactly one question — *did the behaviour change?* Two records with
the same digest behave identically regardless of what their descriptions say.

Updates and deletes use revision compare-and-swap, matching Structured Data.
A stale caller cannot overwrite or delete a newer record.

## The snapshot

```ts
interface PersonaSnapshot {
  readonly personaId: string;        // "builtin:default" for the fallback
  readonly displayName: string;
  readonly revision: number;         // 0 for the built-in
  readonly definition: PersonaDefinition;
  readonly sections: readonly PersonaSectionName[];  // which were folded in
  readonly prompt: string;           // the exact rendered fragment
  readonly context?: ContextEntry;   // Persona's private wrapper — see "The private wrapper"
  readonly definitionDigest: string; // identity of the persona's behaviour
  readonly promptDigest: string;     // sha256 of the rendered bytes
  readonly frozenAt: string;
}
```

The snapshot carries the **rendered prompt string**, not only the definition.
This is redundant data bought on purpose: a pinned task becomes replayable
without Persona in the loop at all, even if the renderer changes later. The
task holds a string, not a promise that a pure function will keep behaving.
Text is cheap; that boundary is not.

Two digests, each answering one question. `definitionDigest` identifies the
persona's behaviour and is stable across section selection. `promptDigest`
identifies the exact bytes this task received. Logs carry both and never carry
the text.

`context`, when present, references Persona's own wrapper record
(`contextWrapperId`), not the author's original entry. This is transparent
to every consumer: `resolveScope` treats it like any other `ContextEntry`.

## Capability interface

```ts
interface PersonaResolveOptions {
  /** Which sections this consumer folds in. Omitted means all five. */
  readonly sections?: readonly PersonaSectionName[];
}

interface CreatePersonaInput {
  readonly displayName: string;
  readonly description?: string;
  readonly definition: PersonaDefinition;
}

interface UpdatePersonaInput {
  readonly id: string;
  readonly expectedRevision: number;
  readonly displayName?: string;
  readonly description?: string;
  readonly definition?: PersonaDefinition;   // replaced wholesale, never patched
}

interface PersonaCapability {
  // ── Transport surface (added during implementation) ───────────────────
  /** Discriminated dispatch for POST /personas/command. Total switch. */
  command(command: PersonaCommand): Promise<PersonaCommandResult>;
  /** Discriminated dispatch for POST /personas/query. Total switch. */
  query(query: PersonaQuery): Promise<PersonaQueryResult>;

  // ── Catalog ───────────────────────────────────────────────────────────
  create(input: CreatePersonaInput): Promise<PersonaRecord>;
  get(id: string): Promise<PersonaRecord | undefined>;
  getByName(displayName: string): Promise<PersonaRecord | undefined>;
  list(): Promise<PersonaRecord[]>;             // live only, name-sorted
  update(input: UpdatePersonaInput): Promise<PersonaRecord>;
  delete(input: { id: string; expectedRevision: number }): Promise<void>;

  // ── Pure ──────────────────────────────────────────────────────────────
  /** No I/O. Same definition and selection always produce the same bytes. */
  render(
    definition: PersonaDefinition,
    sections?: readonly PersonaSectionName[]
  ): string;

  // ── Freeze ────────────────────────────────────────────────────────────
  /**
   * Absent id resolves the built-in. A deleted or unknown id throws rather
   * than falling back, so a consumer never silently gets different behaviour
   * than the one it named.
   */
  resolve(id?: string, options?: PersonaResolveOptions): Promise<PersonaSnapshot>;
}
```

A definition is replaced wholesale on update, never field-patched. Sections are
free text with no merge semantics, so a partial update would only invite a
caller to guess at how two prose fragments combine.

The interface is `Promise`-returning while the store beneath it is synchronous,
matching `StructuredData` over `DataStore`. `render` is the exception and is
synchronous, because it is a pure function and marking it `async` would imply
it might touch the store.

## Ports

Persona takes one external dependency: a narrow port onto Context, satisfied
structurally by `ContextManager` itself — the same pattern Document uses for
its Derived Outputs port ("the real service, passed as-is").

```ts
interface PersonaContextPort {
  declare(
    displayName: string,
    entries: ContextEntry[],
    // `description` added during implementation — the wrapper gets a human-readable
    // blurb ("Private scope wrapper for persona X") so it is self-explaining if
    // someone lists private records while debugging.
    options?: { readonly description?: string; readonly private?: boolean }
  ): Promise<{ id: string; revision: number }>;
  update(
    id: string,
    entries: ContextEntry[],
    expectedRevision: number
  ): Promise<{ id: string; revision: number }>;
  delete(id: string): Promise<void>;
}

// As built: limits and clock arrive inside dependencies rather than as extra
// positional arguments.
interface PersonaDependencies {
  readonly context: PersonaContextPort;
  readonly logger: Logger;
  readonly limits?: PersonaLimits;   // defaults to DEFAULT_PERSONA_LIMITS
  readonly clock?: PersonaClock;     // defaults to () => new Date().toISOString()
}

interface PersonaClock { now(): string; }
```

**Changed during implementation:** the factory is
`createPersonaCapability(store, dependencies)` — two arguments, not the
`(store, dependencies, limits, logger)` this section originally sketched.

The injected `PersonaClock` was not in the original design. It follows Activity
and Comments, and `08-conventions.md` calls it the better pattern than a
module-level `now()`: it is what makes timestamps assertable in tests.

Context is the one runtime dependency this design adds relative to the original
draft, which claimed none — see "The private wrapper" above for why.

Only `create`, `update`, and `delete` touch this port. `resolve`, `render`,
`get`, `getByName`, and `list` never call it — they read the wrapper id and
revision already stored on the record. Persona never calls `context.get`,
`context.resolve`, `context.combine`, or `context.list` — it has no reason to
read Context, only to manage the one record it privately owns.

A `ContextNotFoundError` or `StaleContextError` surfacing from this port
during create/update/delete indicates a bug — nothing else should ever touch
a persona's private wrapper — and is treated as an internal error (500), not
one of the typed Persona errors below.

## Rendering

Pure, synchronous, no I/O. Same input, same bytes, always.

```text
## Focus
<focus>

## Background
<background>

## Approach
<approach>

## Output
<outputPreferences>

## Verification
<verification>
```

Rules:

- fixed order, independent of the order sections were selected in;
- a section that is empty, or not selected, is omitted with its heading;
- each body is trimmed; internal blank lines are preserved as authored;
- sections are joined by exactly one blank line; there is no trailing newline;
- the context reference is never rendered — it is scope, not text.

### Section selection

The consumer chooses which sections apply to the kind of work it does:

```ts
render(definition: PersonaDefinition, sections?: readonly PersonaSectionName[]): string;
```

Omitting `sections` renders all five. A consumer with no verification step
passes the other four. This is why the sections are a fixed named vocabulary
rather than author-defined headings: a consumer cannot select what it cannot
name.

### The fragment is appended, never substituted

This is the load-bearing rule of the whole capability.

**A persona is appended to the consumer's own system content. It never
precedes it and never replaces it.** The consumer's tool contracts, output
schema, and safety rules stay first and non-negotiable; persona text is
advisory guidance underneath them.

An author editing a persona must not be able to dissolve a task's contract.
Persona returns a *fragment* specifically so that no consumer is tempted to
treat it as a whole system prompt.

## The freeze contract

Every agentic consumer follows this sequence:

```text
task start
  ├─ snapshot = await personas.resolve(personaId, { sections })
  ├─ scope    = await knowledge.resolveScope(scopeEntriesFor(task, snapshot))
  ├─ persist snapshot JSON + digests with the task
  │    ── before the first model call, in the same transaction as task creation
  └─ messages = [
       { role: "system", content: CONSUMER_SYSTEM },  // contract — first
       { role: "system", content: snapshot.prompt },  // persona — advisory
       { role: "user",   content: … }
     ]
```

### Scope union, and the empty-scope trap

Naively unioning the persona's context into the task's entries is wrong, and
the failure is silent. `resolveScope([])` means *the whole project*, while
`resolveScope([X])` means *only X*. So adding a persona's context to an empty
task scope would narrow the task from everything to one context — the exact
opposite of the intent.

The rule:

```ts
const scopeEntriesFor = (task, snapshot): ContextEntry[] =>
  // An empty task scope already means the whole project, which subsumes
  // anything the persona could reference. Adding the persona entry here
  // would narrow the scope from everything to one context.
  task.contextEntries.length === 0
    ? []
    : snapshot.context
      ? [...task.contextEntries, snapshot.context]
      : [...task.contextEntries];
```

This holds because a persona's context resolves to project Knowledge sources,
which a whole-project scope already contains. Persona has no way to reference
material outside the project, and no such mechanism is planned.

### Laws

1. **Resolve once per task.** Never per model call, never per run.
2. **Persist before calling.** The snapshot is stored with the task before the
   first model call. A later persona edit cannot reach work already started.
3. **Never precede the contract.** The persona fragment is appended to the
   consumer's system content, never placed before or in place of it.
4. **Union only.** A persona may add reference material; it may never narrow a
   task's scope. The empty-scope rule above is how this law is kept.
5. **Never substitute silently.** Resolving a deleted or unknown persona is an
   error. Falling back to the built-in would change behaviour without saying so.
6. **Never log section text.** Logs carry ids, revisions, and digests. This
   matches the existing rule that diagnostics do not echo prompts or provider
   responses.

## The built-in default

`builtin:default` is a code constant at revision 0. It is not a table row, is
not editable, is not deletable, and is always resolvable — including against an
empty database. Its purpose is to make consumers total without requiring a
seeded row or a migration.

Its definition is a neutral baseline: focus on what was asked, work from
evidence in scope, say plainly when the evidence does not support an answer,
prefer direct prose over hedging, and check claims against the material before
presenting them as settled. It carries no context reference.

### There is no default pointer

The earlier design had a project-wide default pointer under compare-and-swap.
It is dropped on purpose, and this is the largest deletion from that design.

A mutable global pointer silently changes the behaviour of every future task in
the project. That is precisely the action-at-a-distance the freeze model exists
to prevent, reintroduced one layer up. A consumer that wants a project default
stores a persona id in its own configuration, where the choice is visible and
belongs to the thing making it.

## Persistence

One table, project scope only, following the Structured Data pattern exactly —
`CREATE TABLE IF NOT EXISTS`, a `SHA-256(ownerId).slice(0, 16)` table prefix,
no `STRICT`, and case-insensitive name uniqueness via `COLLATE NOCASE` on the
live index rather than a separate normalized column.

```sql
CREATE TABLE IF NOT EXISTS psn_${prefix}_personas (
  id                 TEXT    PRIMARY KEY,
  display_name       TEXT    NOT NULL,
  description        TEXT    NOT NULL DEFAULT '',
  focus              TEXT    NOT NULL DEFAULT '',
  background         TEXT    NOT NULL DEFAULT '',
  approach           TEXT    NOT NULL DEFAULT '',
  output_preferences TEXT    NOT NULL DEFAULT '',
  verification       TEXT    NOT NULL DEFAULT '',
  context_json       TEXT,                          -- {id, kind} or NULL, as authored
  context_wrapper_id       TEXT,                     -- Persona's own private context; NULL iff context_json is NULL
  context_wrapper_revision INTEGER,
  definition_digest  TEXT    NOT NULL,
  revision           INTEGER NOT NULL DEFAULT 1,
  created_at         TEXT    NOT NULL,
  updated_at         TEXT    NOT NULL,
  deleted_at         TEXT,
  -- Added during implementation: makes "a context with no wrapper"
  -- unrepresentable, so the pairing invariant is enforced by the database
  -- rather than only by the service.
  CHECK ((context_json IS NULL AND context_wrapper_id IS NULL)
      OR (context_json IS NOT NULL AND context_wrapper_id IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS psn_${prefix}_personas_name_live_nocase
  ON psn_${prefix}_personas(display_name COLLATE NOCASE)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS psn_${prefix}_personas_live
  ON psn_${prefix}_personas(deleted_at, display_name);
```

Sections are columns rather than one definition blob. The schema is fixed and
known, so "which personas mention retrieval" stays a plain query instead of
JSON extraction. The context reference is a single nullable JSON object because
it is a two-field value, not a list.

`context_wrapper_id` / `context_wrapper_revision` are Persona's own
bookkeeping for the private Context record it created — see "The private
wrapper." They round-trip only within Persona; they are never returned in
place of `context_json` on a read.

Delete is a soft delete. It frees the display name for reuse immediately, since
the unique index is partial on `deleted_at IS NULL`.

**Changed during implementation:** the store port is `Promise`-returning, not
synchronous. Layered capabilities here (Document, Slide, Activity, Comments) use
async store ports; the sync ones are all flat. The SQLite implementation
underneath is still synchronous.

The schema is created by `persistence/sqliteSchema.ts`, which opens with the four
standard pragmas (`journal_mode = WAL`, `foreign_keys = ON`,
`busy_timeout = 5000`, `synchronous = NORMAL`) — the Comments/Document pattern,
rather than Context's single WAL pragma.

## Endpoints

No path parameters — the backend's `getEndpointKey` is exact string equality, so
ids travel in the body.

**Changed during implementation.** This design originally specified seven REST-ish
endpoints; the built shape is the command/query pair used by Document, Slide,
Activity, and Comments.

| Method | Path | Queue | Body |
| --- | --- | --- | --- |
| POST | `/personas/command` | serial | `persona.create` \| `persona.update` \| `persona.delete` |
| POST | `/personas/query` | concurrent | `persona.get` \| `persona.getByName` \| `persona.list` \| `persona.render` |

```jsonc
{ "type": "persona.create", "displayName": "…", "description": "…", "definition": { … } }
{ "type": "persona.update", "id": "…", "expectedRevision": 1, "definition": { … } }
{ "type": "persona.delete", "id": "…", "expectedRevision": 1 }

{ "type": "persona.get", "id": "…" }
{ "type": "persona.getByName", "displayName": "…" }
{ "type": "persona.list" }
{ "type": "persona.render", "definition": { … }, "sections": ["focus"] }
```

`persona.render` is the authoring preview. It is pure and saves nothing, and it
lets the UI show an author the exact text a task would receive, for a definition
that has not been created yet. It sits on the **query** side precisely because it
writes nothing.

Commands are serial because create, update, and delete each read-then-write
across the store *and* the Context port — the store cannot enforce that on its
own, which is the same reasoning that puts Document and Slide commands on the
serial queue.

**There is deliberately no `resolve` endpoint.** Consumers are in-process and
call the capability directly. Exposing snapshot resolution over the wire would
invite a caller to treat a fetched snapshot as a pinned one, when pinning is
the consumer's job and happens in the consumer's transaction.

## Errors

One class per distinguishable failure, in `domain/errors.ts`.

```ts
class PersonaNotFoundError      extends Error { readonly personaId: string }
class PersonaConflictError      extends Error { readonly displayName: string }
class StalePersonaRevisionError extends Error {
  readonly personaId: string;
  readonly expectedRevision: number;
  readonly actualRevision: number;
}
class PersonaValidationError    extends Error {
  readonly field: string;
  readonly reason: string;
}
// Added during implementation:
class BuiltInPersonaImmutableError extends Error { readonly personaId: string }
class PersonaWireError             extends Error {}
```

`BuiltInPersonaImmutableError` exists because mutating `builtin:default` is a
caller error rather than a missing record — reporting it as 404 would be a lie,
since the persona is right there and resolvable.

Domain throws typed errors and never mentions a status code. Job wiring maps
them:

| Error | Status | Wire code |
| --- | --- | --- |
| `PersonaNotFoundError` | 404 | `persona_not_found` |
| `PersonaConflictError` | 409 | `persona_name_conflict` |
| `StalePersonaRevisionError` | 409 | `persona_revision_conflict` |
| `BuiltInPersonaImmutableError` | 409 | `persona_builtin_immutable` |
| `PersonaValidationError` / `PersonaWireError` | 400 | `persona_invalid` |

### Validation at ingress

Validation runs when a definition enters the capability, not on read.

```ts
interface PersonaLimits {
  maxSectionChars: number;      // default 4_000
  maxDefinitionChars: number;   // default 12_000, summed across five sections
  maxDisplayNameChars: number;  // default 120
  maxDescriptionChars: number;  // default 500
  maxPersonas: number;          // default 500 live records
}
```

Rejected: an all-empty definition with no context reference; any section over
`maxSectionChars`; a total over `maxDefinitionChars`; a blank or whitespace-only
display name; a context entry missing `id` or `kind`, or with a non-string
either. Section bodies are trimmed on the way in, so trailing whitespace never
changes a digest.

## Jobs and queues

Every persona operation is local, cheap, and bounded. Reads go on the
concurrent queue, mutations on the serial queue, all inline. There is no
deferred work, no background job, and no scheduler involvement.

`create`, `update`, and `delete` now also make one Context call each (when a
context is present) to manage the private wrapper. That stays a plain
`await` inside the same synchronous call path — still inline on the serial
queue, no new job, no new queue.

## Logging

Four events are implemented:

```text
persona.create   info   { personaId, revision, definitionDigest, sectionCount, hasContext, durationMs }
persona.update   info   { personaId, revision, definitionDigest, digestChanged, durationMs }
persona.delete   info   { personaId, revision, durationMs }
persona.resolve  debug  { personaId, revision, definitionDigest, promptDigest, sectionCount, promptChars, hasContext, durationMs }
```

**Changed during implementation — three planned events were not built:**

```text
persona.render   debug  { sectionCount, promptChars, promptDigest, durationMs }   ← NOT implemented
persona.list     debug  { count, durationMs }                                     ← NOT implemented
persona.get      debug  { personaId, found, durationMs }                          ← NOT implemented
```

The reasoning was that reads are cheap and frequent and a line per catalog read
is noise. That is a judgment call, not a consequence of any house rule, and it
cuts against Context, which *does* log `context.get` and `context.list` at debug.
Adding the three back is a few lines each if read-path observability turns out to
matter — `persona.render` is the most defensible of the three, since it is the
authoring-preview path and its usage is otherwise invisible.

Section text, rendered prompts, display names, and descriptions never appear in a
log record. `promptDigest` exists so two runs can be compared for identical
prompt bytes without ever writing those bytes to the log. There is a regression
test asserting this.

## Testing

Domain, pure:

- render order is fixed regardless of selection order;
- empty and unselected sections are omitted with their headings;
- joining, trimming, and trailing-newline rules hold exactly;
- a definition with only a context reference renders to an empty string;
- `definitionDigest` is stable across key reordering and description edits;
- `definitionDigest` changes on any section edit or context-reference change;
- `promptDigest` changes with section selection while `definitionDigest` does not.

Validation:

- all-empty definition with no context is rejected;
- all-empty definition *with* a context is accepted;
- over-limit section and over-limit total are rejected;
- a malformed context entry is rejected.

Persistence:

- display-name uniqueness is case-insensitive;
- soft delete frees the name for immediate reuse;
- revision compare-and-swap rejects a stale update and a stale delete.

Capability:

- `resolve()` returns the built-in against an empty database;
- `resolve()` on a deleted id throws rather than falling back to the built-in;
- the built-in cannot be updated or deleted.

Private wrapper lifecycle (against a fake `PersonaContextPort`, so these need
no real Context store):

- creating a persona with a context declares exactly one wrapper, named
  `persona:<id>`, with `private: true`;
- creating a persona with no context declares nothing;
- updating a persona's context calls `update` on the *same* wrapper id, never
  `declare` again;
- removing a persona's context (definition replaced with none) calls
  `delete` on the wrapper and clears both wrapper fields;
- adding a context to a persona that had none calls `declare`, not `update`;
- deleting a persona with a wrapper calls `delete` on it before the persona
  row is soft-deleted;
- `GET`/`resolve()` never call the context port at all;
- a record read back exposes `definition.context` exactly as authored, never
  `contextWrapperId`;
- `PersonaSnapshot.context.id` equals `contextWrapperId`, not
  `definition.context.id`, when the two differ.

Wire and architectural:

- each typed error maps to its documented status and code;
- a regression test asserting no persona section text appears in captured log
  records, in the style of the existing `console.*` and startup-ordering greps.

## Consumer sketch — Derived Outputs

Derived Outputs is not changed by this work. This section records how it would
fold a persona in, because it is the nearest real consumer and it is the proof
that the contract is usable.

Today `refresh` builds synthesis messages from a module constant:

```ts
const synthesisMessages: Message[] = [
  { role: "system", content: SYNTHESIS_SYSTEM },
  { role: "user",   content: `PROMPT:\n…\n\nGROUNDING REGIONS:\n${groundingText}` }
];
```

With a persona, the definition gains an optional `personaId`, and the existing
freeze point — where the definition revision, context digest, and Knowledge
generation are already frozen for the attempt — gains one more frozen value:

```ts
const snapshot = await this.personas.resolve(output.definition.personaId, {
  sections: ["focus", "background", "approach", "outputPreferences"]
});

const synthesisMessages: Message[] = [
  { role: "system", content: SYNTHESIS_SYSTEM },   // contract stays first
  ...(snapshot.prompt ? [{ role: "system" as const, content: snapshot.prompt }] : []),
  { role: "user",     content: … }
];
```

Three things about this shape are worth noting, because they generalize to
every future consumer:

- **`verification` is not folded in.** Derived Outputs verifies structurally —
  evidence is accepted only when it matches a trusted retrieval candidate, and
  the output schema is enforced. A persona's prose verification section would
  be advice about a step the capability already performs mechanically. This is
  exactly the case section selection exists for.
- **`SYNTHESIS_SYSTEM` stays first and unchanged.** It carries the evidence
  contract and the output schema. A persona cannot weaken it.
- **The persona's context joins the definition's context entries** before
  `resolveScope`, under the empty-scope rule above, and the resulting
  `scopeDigest` already flows into the attempt record. No new freeze machinery
  is needed — the attempt already stores a frozen definition revision and
  context digest, and would store `personaDigest` alongside them. (The entry
  that actually joins is Persona's private wrapper, not whatever the author
  originally typed — see "The private wrapper." Functionally identical today
  since the wrapper mirrors the author's entry 1:1; this is where a future
  deep-copy wrapper would start actually differing.)

The same shape applies to Agents later: a task pins the snapshot at creation,
and every run of that task uses the pinned copy rather than re-resolving.

## Implementation plan — done

All five steps landed. The as-built layout, following `comments`:

```text
3-capabilities/persona/
  index.ts
  domain/       model.ts errors.ts canonical.ts render.ts validation.ts builtin.ts
  application/  personaService.ts
  ports/        personaStore.ts personaContext.ts
  persistence/  sqliteSchema.ts sqlitePersonaStore.ts
  wire/         common.ts commandSchemas.ts querySchemas.ts
  docs/         README concepts types runtime flows invariants
4-job-wiring/persona/registerPersonaEndpoints.ts
1-init/create/persona.ts
```

`createPersonaCapability(store, dependencies)` — limits and clock arrive inside
`dependencies` rather than as separate positional arguments, matching Comments.
The Context `private` flag this depends on (`scratch/context-persona-update.md`)
landed first.

Tests: `test/capabilities/persona.test.ts` (28) and
`test/capabilities/persona-wiring.test.ts` (8).

### Two implementation notes worth carrying forward

- **Limits live in `domain/validation.ts` as `DEFAULT_PERSONA_LIMITS`, not in
  `etc/configuration.yaml`.** This follows Comments and diverges from the older
  capabilities. Adding a `persona:` config section later is a ~3-line change.
- **No command-receipts table.** Comments carries one because its commands are
  externally retried. Persona's update and delete are naturally idempotent under
  revision CAS, and create is not replayed.

## Known limitations

These are accepted for this version and recorded so they are not rediscovered
as bugs.

- **A composed context is a frozen enumeration.** "The whole project except X"
  is expressible only by enumerating the project at compose time, so a document
  added tomorrow will not appear in it. `resolveScope([])` does mean live
  whole-project, but `[] minus X` cannot be expressed. Fixing this properly
  needs an exclusion primitive on the Context side — a scope that carries
  negative entries and is evaluated at resolve time rather than compose time.
  Until then, a caller who wants a persona's exclusion scope to stay current
  must re-compose and re-point the persona.

- **The private wrapper can be orphaned by a partial write.** Persona's
  `create`/`update` call Context first, then write its own row second (see
  "The private wrapper"). If the Context call succeeds but the following
  Persona write fails, the wrapper is left behind: private (never listed),
  unreferenced, and harmless beyond disk usage. This is accepted rather than
  solved with the full durable-claim machinery Document uses for delegated
  commands (`DocumentDelegatedCommandClaim`) — that costs more than an
  occasional orphaned private row is worth at this scale. This also means the
  original concern about anonymous contexts needing an external sweep job no
  longer applies in its old form: Persona now owns its wrapper's full
  lifecycle symmetrically with its own (delete the persona, delete the
  wrapper), so there is no general-purpose retention problem for a
  housekeeping job to solve — only this one narrow, accepted gap.

- **A deleted referenced context degrades silently, one hop later.** Context's
  `resolve` omits missing ids rather than erroring. If the entry Persona
  wrapped is itself deleted (e.g. an author-composed context that someone
  else later removes), the wrapper still exists and still resolves, but
  contributes no material — same failure mode as before wrapping, just
  observed through the wrapper instead of directly. Persona still cannot
  detect this without reading Context, which now it *could* do (it has the
  dependency) but doesn't, on purpose — see Ports.

## Non-goals

- **No Library kernel, no library/local split, no version table.** The freeze
  model already provides the guarantee those existed to provide: work in flight
  cannot be changed by a later edit, because the task holds its own copy.
- **No project default pointer.** See the reasoning above.
- **No persona composition or stacking.** One persona per task. The snapshot is
  already a separate value from the record, so composition can be added later
  as a merge over definitions without changing the consumer contract.
- **No variables or templating inside sections.** Sections are literal text.
- **No cast or model selection in a persona.** Routing stays with Intelligence
  casts. A persona describing *how to think* must not also decide *what
  hardware thinks*, or every persona edit becomes a cost change.
- **No tool policy.** That belongs to Agents.
- **No Activity publication of persona changes.** Doing it correctly needs an
  outbox row written in the same transaction as the mutation, which is more
  machinery than a catalog capability warrants right now.
- **No per-user personas.** Project scope only, matching Templates. The
  user/project split that Context carries is not obviously right for behaviour
  definitions and should be driven by a real need.
- **No changes to Derived Outputs, or to any existing capability besides
  Context.** The consumer sketch above is a description, not a scheduled
  change. Context does change: `declare`/`composeNamed` gain an optional
  `private` flag and `list()` gains an `includePrivate` filter, replacing the
  removed `~`-prefix/`includeAnonymous` convention. See
  `scratch/context-persona-update.md` for the exact diff.

- **No deep copy of the referenced context, yet.** The private wrapper holds
  a reference, not a snapshot of resolved content. See "The private wrapper"
  and the orphan-on-partial-write limitation above.
