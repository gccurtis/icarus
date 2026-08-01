# Persona Capability — Design

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
- Context records, Context composition, or scope resolution;
- Knowledge sources or retrieval; or
- where in a message list its fragment is placed.

```text
caller composes a Context  ──►  context record id
                                     │
persona record { sections, context } ─┘
        │  resolve (freeze)
        ▼
PersonaSnapshot { prompt, context, digests }
        │
        └──►  consumer task: system messages + scope union
```

The important consequence: **Persona never resolves its own context
reference.** It holds the reference as an opaque `ContextEntry` and passes it
to the consumer, which unions it into its own scope and hands the result to
`knowledge.resolveScope(...)` — the same call Derived Outputs already makes,
which expands nested Context records and every resource kind exactly once.
Persona therefore has a type-only import from `#context/types.js` and zero
runtime dependency on `ContextManager` or Knowledge.

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
  → POST /project/contexts/compose { op: "difference", a, b }
  → anonymous ~uuid context record
  → persona.context = { id: thatRecord.id, kind: "context" }
```

`compose` is already implemented and registered (`context.ts:208`,
`registerContextEndpoints.ts:276`). It runs the operation and persists the
result as an anonymous `~`-prefixed record, returning its id. No new Context
work is required for this design.

`kind` is not constrained to `"context"`. A persona may reference a document or
any other resource kind directly when that is all it needs; the consumer's
`resolveScope` handles every kind uniformly. Constraining the kind would buy
nothing and would block the simple case of "this persona always reads the style
guide."

## The record

```ts
interface PersonaRecord {
  readonly id: string;
  readonly displayName: string;      // unique among live records, case-insensitive
  readonly description: string;      // catalog blurb; never rendered, never digested
  readonly definition: PersonaDefinition;
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
  readonly context?: ContextEntry;
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
  context_json       TEXT,                          -- {id, kind} or NULL
  definition_digest  TEXT    NOT NULL,
  revision           INTEGER NOT NULL DEFAULT 1,
  created_at         TEXT    NOT NULL,
  updated_at         TEXT    NOT NULL,
  deleted_at         TEXT
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

Delete is a soft delete. It frees the display name for reuse immediately, since
the unique index is partial on `deleted_at IS NULL`.

The store is synchronous, matching `DataStore` and `ContextStore`; the
capability interface is `Promise`-returning, matching `StructuredData`.

## Endpoints

No path parameters — ids travel in query or body.

| Method | Path | Params |
| --- | --- | --- |
| POST | `/personas` | body `{displayName, description?, definition}` |
| GET | `/personas` | — live records, name-sorted |
| GET | `/personas/entry` | query `?id=` |
| GET | `/personas/by-name` | query `?displayName=` |
| PATCH | `/personas` | body `{id, expectedRevision, displayName?, description?, definition?}` |
| DELETE | `/personas` | body `{id, expectedRevision}` |
| POST | `/personas/render` | body `{definition, sections?}` |

`POST /personas/render` is the authoring preview. It is pure and saves nothing,
and it lets the UI show an author the exact text a task would receive, for a
definition that has not been created yet.

**There is deliberately no `resolve` endpoint.** Consumers are in-process and
call the capability directly. Exposing snapshot resolution over the wire would
invite a caller to treat a fetched snapshot as a pinned one, when pinning is
the consumer's job and happens in the consumer's transaction.

## Errors

Naming follows Structured Data's flat-capability convention.

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
```

Domain throws typed errors and never mentions a status code. Job wiring maps
them:

| Error | Status | Wire code |
| --- | --- | --- |
| `PersonaNotFoundError` | 404 | `persona_not_found` |
| `PersonaConflictError` | 409 | `persona_name_conflict` |
| `StalePersonaRevisionError` | 409 | `persona_revision_conflict` |
| `PersonaValidationError` | 400 | `persona_invalid` |

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

## Logging

```text
persona.create   info   { personaId, revision, definitionDigest, sectionCount, hasContext, durationMs }
persona.update   info   { personaId, revision, definitionDigest, digestChanged, durationMs }
persona.delete   info   { personaId, revision, durationMs }
persona.resolve  debug  { personaId, revision, definitionDigest, promptDigest, sectionCount, promptChars, hasContext, durationMs }
persona.render   debug  { sectionCount, promptChars, promptDigest, durationMs }
persona.list     debug  { count, durationMs }
persona.get      debug  { personaId, found, durationMs }
```

Section text, rendered prompts, and descriptions never appear in a log record.
`promptDigest` exists so two runs can be compared for identical prompt bytes
without ever writing those bytes to the log.

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
  context digest, and would store `personaDigest` alongside them.

The same shape applies to Agents later: a task pins the snapshot at creation,
and every run of that task uses the pinned copy rather than re-resolving.

## Implementation plan

1. **Pure domain first.** `types.ts`, `canonical.ts`, `render.ts`,
   `validation.ts`, and the built-in constant. No I/O, no store, no logger.
   Every rule in the Rendering and Validation sections becomes a test before
   the code exists.

2. **Store port and SQLite adapter.** `store.ts` and `sqlite-store.ts` with the
   schema above, revision compare-and-swap on update and delete, soft delete,
   and case-insensitive live-name uniqueness.

3. **Capability service.** `persona.ts` with `createPersonaCapability(store,
   limits, logger)`, the built-in fallback, limit enforcement, and the logging
   above.

4. **Wiring.** `4-job-wiring/persona/registerPersonaEndpoints.ts`, error-to-code
   mapping, `1-init/create/persona.ts`, and `#persona` / `#persona/*` aliases
   with explicit `development`, `types`, and compiled `default` conditions.

5. **Docs package.** `docs/` beside the module with the six standard files, and
   a "Status and authority" section in `README.md` stating plainly that
   `docs/capabilities-old/persona.md` describes a Library-kernel design that was
   not built and must not be read as current behaviour.

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

- **Anonymous contexts referenced by a persona are a retention root.** Context
  documents a future housekeeping job that sweeps unreferenced anonymous
  (`~`-prefixed) contexts. That job must treat a persona's `context_json`
  reference as a reference, or it will silently strip material from personas
  that are working correctly. This is a requirement placed on that future job,
  not something Persona can enforce alone.

- **A deleted referenced context degrades silently.** Context's `resolve`
  omits missing ids rather than erroring. A persona pointing at a deleted
  context therefore contributes no material, and the task proceeds with a
  narrower scope than the author intended. The consumer's scope manifest is
  where this is observable; Persona cannot detect it without taking a runtime
  dependency on Context, which would cost more than the check is worth.

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
- **No changes to Derived Outputs, Context, or any other existing capability.**
  The consumer sketch above is a description, not a scheduled change.
