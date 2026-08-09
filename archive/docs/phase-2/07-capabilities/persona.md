# 07 · Persona

*Verified against source at commit ef6d462, 2026-08-09.*

Persona is a catalog of reusable instruction sets. A persona is five named prose sections —
`focus`, `background`, `approach`, `outputPreferences`, `verification` — plus an optional reference
to a Context entry, and it renders deterministically into one markdown prompt fragment. Its central
mechanism is the **freeze**: `resolve()` returns a `PersonaSnapshot` carrying the exact rendered
bytes and two digests, so a task that pinned a persona replays identically even after the persona is
edited or deleted. That mechanism has **no production consumer** — `resolve()` is called only by
tests. What is reachable today is the catalog: create, read, update, delete, purge and a pure
render query, over two HTTP endpoints.

Persona's only dependency is [Context](context.md), and it consumes it through a three-method port
that `ContextManager` satisfies **structurally**, with no adapter. That seam currently harbours a
defect: changing a persona's context reference always returns HTTP 500 (§9.1).

The archived design at
[phase-1/capabilities-old/persona.md](../../phase-1/capabilities-old/persona.md) describes a
library-kernel asset/version model with a library/local split, materialization receipts, a
revisioned default pointer, eight-plus REST routes, five tables, and a `behavioralGuidance` field.
**None of that exists.** The module's own `docs/README.md:27-31` already warns about that page, and
the warning is correct.

---

## 1 · At a glance

| Property | Value |
| --- | --- |
| Shape | Layered — `domain/ application/ ports/ persistence/ wire/` |
| Endpoints | **2** — `POST /personas/command` (serial), `POST /personas/query` (concurrent) |
| DB file | `data/personas.db`, opened cwd-relative as `./data/personas.db` |
| Tables | **2** — `_personas` (live rows, sections as columns), `_history` (the shared revision-history table) |
| Revision model | Current row plus history. `revision` starts at 1; `update` and `delete` are transactional CAS on a **client-supplied `expectedRevision`** |
| Idempotency | **None.** No receipts table, no request id. A retried `persona.create` creates a second persona or 409s |
| Activity | **None.** Persona writes nothing into the ledger |
| Test files | `persona.test.ts` (**32 tests**, 669 lines), `persona-wiring.test.ts` (**11 tests**, 402 lines) = **43** |
| Source files / lines | **15 files / 1,609 lines**, plus `4-job-wiring/persona/registerPersonaEndpoints.ts` (114) and `1-init/create/persona.ts` (24) |
| Module docs | 6 files, 969 lines, at [`src/3-capabilities/persona/docs/`](../../../apps/backend/src/3-capabilities/persona/docs/) |
| Status | Wired. `resolve()` has no production consumer. **Changing a persona's context reference always returns 500** (§9.1) |

Per-file line counts:

| File | Lines |
| --- | ---: |
| [`application/personaService.ts`](../../../apps/backend/src/3-capabilities/persona/application/personaService.ts) | 538 |
| [`persistence/sqlitePersonaStore.ts`](../../../apps/backend/src/3-capabilities/persona/persistence/sqlitePersonaStore.ts) | 226 |
| [`domain/model.ts`](../../../apps/backend/src/3-capabilities/persona/domain/model.ts) | 152 |
| [`domain/validation.ts`](../../../apps/backend/src/3-capabilities/persona/domain/validation.ts) | 140 |
| [`wire/common.ts`](../../../apps/backend/src/3-capabilities/persona/wire/common.ts) | 99 |
| [`wire/commandSchemas.ts`](../../../apps/backend/src/3-capabilities/persona/wire/commandSchemas.ts) | 78 |
| [`persistence/sqliteSchema.ts`](../../../apps/backend/src/3-capabilities/persona/persistence/sqliteSchema.ts) | 59 |
| [`domain/errors.ts`](../../../apps/backend/src/3-capabilities/persona/domain/errors.ts) | 54 |
| [`domain/canonical.ts`](../../../apps/backend/src/3-capabilities/persona/domain/canonical.ts) | 53 |
| [`domain/render.ts`](../../../apps/backend/src/3-capabilities/persona/domain/render.ts) | 48 |
| [`domain/builtin.ts`](../../../apps/backend/src/3-capabilities/persona/domain/builtin.ts) | 39 |
| [`wire/querySchemas.ts`](../../../apps/backend/src/3-capabilities/persona/wire/querySchemas.ts) | 38 |
| [`ports/personaContext.ts`](../../../apps/backend/src/3-capabilities/persona/ports/personaContext.ts) | 33 |
| [`index.ts`](../../../apps/backend/src/3-capabilities/persona/index.ts) | 29 |
| [`ports/personaStore.ts`](../../../apps/backend/src/3-capabilities/persona/ports/personaStore.ts) | 23 |

Persona's whole git history is two commits: `61c292f` (2026-08-02 00:04:26 −0500,
*"feat(persona): add the Persona capability"*) and `1cbe845` (2026-08-02 12:43:52 −0500, the shared
retention adoption, which also rewrote the Context seam — see §8).

---

## 2 · Domain model

### 2.1 The five sections

```ts
/**
 * The five sections of a definition, in render order. This array is the single
 * source of that order — the renderer and the wire decoder both read it, so a
 * section cannot be added in one place and forgotten in the other.
 */
export const PERSONA_SECTION_NAMES = [
  "focus", "background", "approach", "outputPreferences", "verification"
] as const;
```

— `domain/model.ts:9-20`

`PERSONA_SECTION_HEADINGS` (`:25-31`) is `as const satisfies Record<PersonaSectionName, string>`:

| Section | Heading rendered |
| --- | --- |
| `focus` | `Focus` |
| `background` | `Background` |
| `approach` | `Approach` |
| `outputPreferences` | **`Output`** |
| `verification` | `Verification` |

The heading for `outputPreferences` is `Output`, not `Output Preferences`.

### 2.2 `PersonaDefinition` (`:33-46`)

Five `readonly string` sections plus `readonly context?: ContextEntry`. Each field carries a
one-line comment that is the closest thing to a specification of what belongs in it:

| Field | Comment, verbatim |
| --- | --- |
| `focus` | *"What to concentrate on, and what to deliberately leave alone."* |
| `background` | *"Standing facts the task should assume without being told."* |
| `approach` | *"How to work: method, rigour, standards, boundaries."* |
| `outputPreferences` | *"What the result should look like: shape, length, formatting, tone."* |
| `verification` | *"What to check before presenting the result as finished."* |
| `context` | *"Optional reusable material this persona brings with it."* |

`ContextEntry` is imported from `#context` and re-exported, under a header that explains the
ownership chain:

```ts
// Persona canonical types.
// ContextEntry is defined in knowledge/types.ts and re-exported by Context; Persona
// takes it from Context so the ownership story stays readable at call sites.
```

— `domain/model.ts:1-3`

The type actually originates in `0-platform/knowledge/types.ts:85`; Context re-exports it, and
Persona takes it from Context. See [01-layers-and-boundaries.md](../01-layers-and-boundaries.md).

### 2.3 `PersonaRecord` (`:48-67`)

`{ id, displayName, description, definition, contextWrapperId?, contextWrapperRevision?, revision,
definitionDigest, createdAt, updatedAt }`, all `readonly`.

Three fields carry load-bearing comments:

```ts
  /**
   * Persona's own private Context record wrapping definition.context.
   * Present iff definition.context is present. Internal bookkeeping — never
   * returned in place of definition.context, and excluded from the digest
   * because it lives outside PersonaDefinition.
   */
```

— `domain/model.ts:54-59`

> `/** Catalog blurb. Never rendered, never digested. */` — `description`, `domain/model.ts:51`

> `/** sha256 over the canonical definition. Answers: did the behaviour change? */`
> — `definitionDigest`, `domain/model.ts:63`

### 2.4 `PersonaSnapshot` (`:69-87`) — the freeze

`{ personaId, displayName, revision, definition, sections, prompt, context?, definitionDigest,
promptDigest, frozenAt }`. Field comments, verbatim:

| Field | Comment |
| --- | --- |
| `personaId` | *`"builtin:default" for the fallback.`* |
| `revision` | *`0 for the built-in.`* |
| `sections` | *`Which sections were folded in, in render order.`* |
| `prompt` | *`The exact rendered fragment. Carried so a pinned task replays without Persona.`* |
| `context` | *`Persona's private wrapper record, not the entry the author authored.`* |
| `definitionDigest` | *`Identity of the persona's behaviour. Stable across section selection.`* |
| `promptDigest` | *`sha256 of the rendered bytes. Varies with section selection.`* |

### 2.5 Rendering

`domain/render.ts`, 48 lines, pure and synchronous. Header:

```ts
// Deterministic rendering of a definition into one prompt fragment.
// Pure and synchronous. Same definition and selection always produce the same bytes.
```

— `domain/render.ts:1-2`

`selectPersonaSections(definition, sections?)` (`:17-27`) filters `PERSONA_SECTION_NAMES` by
"requested, or nothing requested" **and** `definition[section].trim().length > 0`. `renderPersona`
(`:42-48`) is one expression:

```ts
selectPersonaSections(definition, sections)
  .map((section) => `## ${PERSONA_SECTION_HEADINGS[section]}\n${definition[section].trim()}`)
  .join("\n\n")
```

Headings are a markdown `##` followed by a space, the body starts on the next line, blocks are
joined by exactly one blank line, and there is no trailing newline. The full contract is in the
docblock (§8).

### 2.6 Digests

`domain/canonical.ts`, 53 lines. `canonicalValue` (`:10-21`) sorts object keys and drops
`undefined` members; `canonicalize` produces a UTF-8 `Buffer` of the `JSON.stringify` of that;
`canonicalDigest` is its sha256 hex. Neither `canonicalize` nor `canonicalDigest` is re-exported by
`index.ts`.

`digestPersonaDefinition` (`:40-49`) builds `{focus, background, approach, outputPreferences,
verification}` in `PERSONA_SECTION_NAMES` order and adds `context: {id, kind}` **only if**
`definition.context` is present. `digestPrompt` (`:51-53`) is `sha256(prompt, "utf8")`, commented
*"Identity of the exact bytes a task received."*

The two digests answer different questions: `definitionDigest` is stable across section selection
and across renames; `promptDigest` varies with selection. `persona.test.ts` test 8 pins exactly
that.

### 2.7 The built-in fallback

`domain/builtin.ts`, 39 lines. Header:

```ts
// The built-in fallback persona.
//
// A code constant at revision 0. Not a table row, not editable, not deletable,
// and always resolvable — including against an empty database. Its purpose is to
// make consumers total without requiring a seeded row or a migration.
```

— `domain/builtin.ts:1-5`

`BUILTIN_PERSONA_ID = "builtin:default"`; `isBuiltInPersonaId(id)` is exact equality.
`BUILTIN_PERSONA` has `displayName: "Default"`, `description: "Neutral baseline used when a
consumer names no persona."`, `revision: 0`, both timestamps pinned to
`"1970-01-01T00:00:00.000Z"`, and a `definitionDigest` computed at module load. Its definition sets four sections;
**`background` is `""`** and there is no context reference. The four bodies, verbatim
(`domain/builtin.ts:14-28`):

| Section | Body |
| --- | --- |
| `focus` | *"Address what was actually asked. Leave adjacent concerns alone unless they change the answer."* |
| `approach` | *"Work from the evidence in scope. When the evidence does not support an answer, say so plainly rather than filling the gap with plausible prose."* |
| `outputPreferences` | *"Prefer direct prose over hedging. Lead with the answer, then the reasoning that supports it."* |
| `verification` | *"Check each claim against the material before presenting it as settled. Distinguish what the evidence shows from what you inferred."* |

### 2.8 Errors

| Class | Line | Message shape |
| --- | ---: | --- |
| `PersonaNotFoundError(personaId)` | 1 | `` `Persona '${personaId}' was not found` `` |
| `PersonaConflictError(displayName)` | 8 | `` `Persona '${displayName}' already exists` `` |
| `StalePersonaRevisionError(id, expected, actual)` | 15 | `` `Stale revision for persona ${id}: expected ${e}, current ${a}` `` |
| `PersonaValidationError(field, reason)` | 28 | `` `${field}: ${reason}` `` |
| `BuiltInPersonaImmutableError(personaId)` | 42 | `` `Persona '${id}' is built in and cannot be modified` `` |
| `PersonaWireError(message)` | 49 | as given |

All in `domain/errors.ts`. `BuiltInPersonaImmutableError` exists for a stated reason:

```ts
/**
 * The built-in fallback is a code constant, not a row. Attempting to mutate it is
 * a caller error rather than a missing record, so it gets its own class.
 */
```

— `domain/errors.ts:38-41`

---

## 3 · Commands, queries and the capability surface

### 3.1 Commands

`PersonaCommand` (`domain/model.ts:115-119`) is a four-arm union whose arms each wrap a typed
input:

| Command | Input | Result | HTTP |
| --- | --- | --- | ---: |
| `persona.create` | `CreatePersonaInput { displayName, description?, definition }` | `persona.created` + `PersonaRecord` | **201** |
| `persona.update` | `UpdatePersonaInput { id, expectedRevision, displayName?, description?, definition? }` | `persona.updated` + `PersonaRecord` | 200 |
| `persona.delete` | `DeletePersonaInput { id, expectedRevision }` | `persona.deleted` + `{personaId, revision}` | 200 |
| `persona.purge` | `PurgePersonaInput { id }` | `persona.purged` + `{personaId}` | 200 |

`UpdatePersonaInput.definition` carries the comment *"Replaced wholesale, never field-patched."*
(`:102`) — there is no per-section patch command.

`persona.deleted` reports `revision: command.input.expectedRevision + 1`
(`personaService.ts:119-123`) — the terminal revision, computed from the caller's input rather than
read back from the store.

### 3.2 Queries

`PersonaQuery` (`:129-137`), four arms:

| Query | Fields | Result |
| --- | --- | --- |
| `persona.get` | `id` | `persona.entry` + `PersonaRecord`; 404 if missing |
| `persona.getByName` | `displayName` | `persona.entry` + `PersonaRecord`; 404 if missing |
| `persona.list` | — | `persona.records` + all live records, name-sorted |
| `persona.render` | `definition`, `sections?` | `persona.rendered` + `{prompt, promptDigest, sections}` |

`persona.render` is pure: it validates the supplied definition, renders it, and returns the bytes
and their digest. It touches no store and no Context.

### 3.3 `PersonaCapability` — every method

`application/personaService.ts:52-81`, grouped by the file's own section comments:

| Group | Methods |
| --- | --- |
| Transport surface | `command(command)`, `query(query)` |
| Catalog | `create(input)`, `get(id)`, `getByName(displayName)`, `list()`, `update(input)`, `delete(input)`, `purge(input)`, `pruneHistory(cutoff)`, `purgeExpired(cutoff)` |
| Pure | `render(definition, sections?)` |
| Freeze | `resolve(id?, options?)` |

Behavioural details that are easy to get wrong:

- **`get("builtin:default")` returns the built-in** (`:270`), synthesised from the code constant.
- **`getByName` does not** (`:274-276`) — it goes straight to the store, so
  `persona.getByName("Default")` is a 404 while `persona.get("builtin:default")` is a 200. This is
  deliberate and documented in the module's `docs/runtime.md`, but the asymmetry is real.
- `persona.getByName` throws `PersonaNotFoundError(query.displayName)` (`:151`), which puts the
  *name* into the error's `personaId` slot and therefore into the message.
- `purgeExpired(cutoff)` loops `store.expiredDeleted(cutoff)` and calls `this.purge({id})` for each
  (`:477-484`), rather than calling the store directly — that is what makes retention purge the
  owned Context wrapper too.
- `command` and `query` are **total switches with no `default` clause**, by design (§8).

### 3.4 The wire layer

`wire/` is 215 lines across three files. `wire/common.ts` supplies the primitives — `record`,
`exactKeys`, `stringField`, `optionalStringField`, `revisionField`, `sectionsField`,
`definitionField` — and three of them carry rationale comments quoted in §8.

`decodePersonaCommand` (`wire/commandSchemas.ts:12-78`) and `decodePersonaQuery`
(`wire/querySchemas.ts:5-38`) enforce exact key sets:

| Message | Allowed keys |
| --- | --- |
| `persona.create` | `type, displayName, description, definition` |
| `persona.update` | `type, id, expectedRevision, displayName, description, definition` |
| `persona.delete` | `type, id, expectedRevision` |
| `persona.purge` | `type, id` |
| `persona.get` | `type, id` |
| `persona.getByName` | `type, displayName` |
| `persona.list` | `type` |
| `persona.render` | `type, definition, sections` |

Unknown `type` yields `Unsupported Persona command '<type>'` / `Unsupported Persona query
'<type>'`. `definitionField` applies `exactKeys(definition, [...PERSONA_SECTION_NAMES, "context"])`
— so an unknown section name is a 400, not a silently ignored field.

### 3.5 Validation and limits

`domain/validation.ts:1`: `// Ingress validation. Runs when a definition enters the capability,
never on read.`

`DEFAULT_PERSONA_LIMITS` (`:22-28`):

| Limit | Default | Applied to | Enforced at |
| --- | ---: | --- | --- |
| `maxSectionChars` | 4,000 | each section body **after trimming** | `validation.ts:113-118` |
| `maxDefinitionChars` | 12,000 | the five trimmed sections summed | `validation.ts:123-128` |
| `maxDisplayNameChars` | 120 | the trimmed display name | `validation.ts:42-47` |
| `maxDescriptionChars` | 500 | the description, **not** trimmed | `validation.ts:56-61` |
| `maxPersonas` | 500 | live records, checked **only on create** | `personaService.ts:206-212` |

- `validateDisplayName` (`:34-49`) trims, and rejects non-strings and blanks.
- `validateDescription` (`:51-63`) returns `""` for `undefined` and rejects non-strings.
- `validateContextEntry` (`:65-77`) requires `{id, kind}` both non-empty strings and **narrows to
  exactly those two fields** — extra keys on a context entry are silently dropped by the domain,
  because `definitionField` at the wire allows the `context` key without inspecting inside it.
- `validateDefinition` (`:88-140`) starts all five sections at `""`, trims each supplied string,
  and returns a fresh object. Unknown top-level keys are ignored here; the wire layer is what
  rejects them.

There is **no `persona:` section in `etc/configuration.yaml` and no `config.persona` in
`loadBackendConfig.ts`**. `1-init/create/persona.ts` passes no `limits` and no `clock`, so
production always runs the defaults and the system clock.

---

## 4 · Endpoints

[`4-job-wiring/persona/registerPersonaEndpoints.ts`](../../../apps/backend/src/4-job-wiring/persona/registerPersonaEndpoints.ts),
114 lines. Two routes, and a manifest log
`persona.endpoints.registered { count: 2, endpoints: [...] }` (`:110-113`) that matches reality.

| Method | Path | Job name | Queue | Response mode | What it does |
| --- | --- | --- | --- | --- | --- |
| POST | `/personas/command` | `persona.command.v1` | **serial** | inline | Decodes and dispatches one of the four commands. **201** for `persona.created`, 200 otherwise |
| POST | `/personas/query` | `persona.query.v1` | concurrent | inline | Decodes and dispatches one of the four queries. Always 200 on success |

The serial choice is justified in place:

```ts
// Serial: create, update, and delete each read-then-write across the store and
// the Context port, which the store cannot guard on its own.
```

— `registerPersonaEndpoints.ts:70-71`

**There is no `resolve` endpoint.** `resolve()` is in-process only, and nothing in-process calls it
(§9.2).

### 4.1 The error ladder

`errorResponse` (`:20-47`), in evaluation order — eight rungs and a fallthrough:

| Error | Status | Body `error` |
| --- | ---: | --- |
| `ResourceNotDeletedError` | 409 | `not_deleted` |
| `ResourceHistoryNotFoundError` | 404 | `not_found` |
| `PersonaNotFoundError` | 404 | `persona_not_found` |
| `PersonaConflictError` | 409 | `persona_name_conflict` |
| `StalePersonaRevisionError` | 409 | `persona_revision_conflict` |
| `BuiltInPersonaImmutableError` | 409 | `persona_builtin_immutable` |
| `PersonaValidationError` \| `PersonaWireError` | 400 | `persona_invalid` |
| anything else | 500 | `internal_error`, message fixed at `"Persona operation failed"` |

> `// Internal errors never leak detail to the client; the real message is logged.`
> — `registerPersonaEndpoints.ts:45`

**Only `>= 500` responses are logged at the wiring layer** (`:82-84`, `:102-104`), through
`logUnexpected` → `logger.error` with `{requestId, errorName, errorMessage}`. A 400 or 409 produces
no wiring log record at all — the opposite of [Comments](comments.md), which logs every non-2xx.
That is also what makes §9.1 hard to notice from the outside and easy to find in the log.

### 4.2 Composition

[`1-init/create/persona.ts`](../../../apps/backend/src/1-init/create/persona.ts), 24 lines:

```ts
const PERSONA_DB_PATH = "./data/personas.db";

/**
 * ContextManager structurally satisfies PersonaContextPort, so it is passed
 * as-is. Persona uses only declare/update/delete, and only to manage the private
 * wrapper record it owns per persona.
 */
export const createPersonaInstance = (config, context: ContextManager, logger) => {
  const store = new SQLitePersonaStore(config.projectId, PERSONA_DB_PATH);
  return createPersonaCapability(store, { context, logger });
};
```

**That docblock is stale** — the port has no `update`; it has `declare`, `delete` and `purge`
(§9.5).

In `startBackend.ts`: Persona is constructed at `:64`, immediately after `contextManager` (`:60`),
under the comment

```ts
// Persona's only dependency is Context, which it uses to manage the private
// wrapper record it owns per persona.
```

— `startBackend.ts:62-63`

Its retention port is bound at `:127` (second of eleven, right after Document), the readiness flag
`personaReady` is logged at `:171`, and endpoints are registered at `:183`.

---

## 5 · Persistence

Two tables in `data/personas.db`, prefix
`` psn_${sha256(projectId).digest("hex").slice(0, 16)} ``
(`persistence/sqliteSchema.ts:10-16`). Pragmas (`:22-25`): `journal_mode = WAL`,
`foreign_keys = ON`, `busy_timeout = 5000`, `synchronous = NORMAL` — all four.

### 5.1 `psn_<prefix>_personas` — live records only

| Column | Type | Constraint |
| --- | --- | --- |
| `id` | TEXT | PRIMARY KEY — a `randomUUID()` |
| `display_name` | TEXT | NOT NULL |
| `description` | TEXT | NOT NULL DEFAULT `''` |
| `focus` | TEXT | NOT NULL DEFAULT `''` |
| `background` | TEXT | NOT NULL DEFAULT `''` |
| `approach` | TEXT | NOT NULL DEFAULT `''` |
| `output_preferences` | TEXT | NOT NULL DEFAULT `''` |
| `verification` | TEXT | NOT NULL DEFAULT `''` |
| `context_json` | TEXT | nullable — JSON of the **authored** `ContextEntry` |
| `context_wrapper_id` | TEXT | nullable |
| `context_wrapper_revision` | INTEGER | nullable |
| `definition_digest` | TEXT | NOT NULL |
| `revision` | INTEGER | NOT NULL DEFAULT 1 |
| `created_at`, `updated_at` | TEXT | NOT NULL |

Table-level constraint (`:48-49`):

```sql
CHECK ((context_json IS NULL AND context_wrapper_id IS NULL)
    OR (context_json IS NOT NULL AND context_wrapper_id IS NOT NULL))
```

This makes "a context with no wrapper" **unrepresentable at the database level**. Note that
`context_wrapper_revision` is *not* covered by the CHECK.

Indexes (`:52-56`):

- `psn_<prefix>_personas_name_nocase` — **UNIQUE** on `(display_name COLLATE NOCASE)`
- `psn_<prefix>_personas_display_name` — plain, on `(display_name)`

The schema explains why the sections are columns:

```ts
  // Sections are columns rather than one definition blob: the schema is fixed and
  // known, so "which personas mention retrieval" stays a plain query instead of
  // JSON extraction. The context reference is a single nullable JSON object
  // because it is a two-field value, not a list.
```

— `persistence/sqliteSchema.ts:27-30`

### 5.2 `psn_<prefix>_history`

The shared table from `0-utils/persistence/resourceHistory.ts`, with `resource_kind = 'persona'`
throughout. Columns, `CHECK`s, the composite primary key and the `_recorded` index are identical
everywhere the helper is used; see
[04-state-and-persistence.md](../04-state-and-persistence.md).

### 5.3 The revision model, spelled out

- **Insert** writes `revision: 1` (`personaService.ts:240`). No history row at creation.
- **Update is a transactional CAS** (`sqlitePersonaStore.ts:125-165`):
  `SELECT … WHERE id = ? AND revision = ?` with the client's `expectedRevision`; if absent, return
  `false`; otherwise archive the **previous complete `PersonaRecord`** as a history `snapshot` at
  `previous.revision`, then `UPDATE … WHERE id = ? AND revision = ?` and require `changes === 1`.
  The new revision is `existing.revision + 1` (`personaService.ts:315`). Note the archived
  snapshot's `recordedAt` is `record.updatedAt` — the **new** record's timestamp
  (`sqlitePersonaStore.ts:137`).
- **Delete is one transaction** (`sqlitePersonaStore.ts:167-191`): archive the current record as a
  `snapshot` at its own revision, append a `deleted` row at `revision + 1`, then
  `DELETE FROM personas WHERE id = ? AND revision = ?`. **The display name is freed immediately.**
- A lost CAS on either path is converted by the service into
  `StalePersonaRevisionError(id, expected, current)` after re-reading, or `PersonaNotFoundError` if
  the row is gone entirely (`personaService.ts:337-339`, `:447-449`).
- `latestSnapshot(id)` (`:193-201`) reverses history and takes the last `snapshot` record. It is
  how `purge` recovers the wrapper id from a record that no longer exists.
- `purge(id)` (`:203-208`) refuses while the record is live (`ResourceNotDeletedError`) and throws
  `ResourceHistoryNotFoundError` when no history remains.
- `pruneHistory(cutoff)` (`:210-219`) delegates to `pruneHistoryBefore` with a liveness predicate;
  `expiredDeleted(cutoff)` (`:221-225`) filters the shared listing to `resourceKind === "persona"`.
- **Reads touch only the current table.** `get`, `getByName`, `list` and `countLive` never read
  history. `list()` is `ORDER BY display_name COLLATE NOCASE, id`.

`expectedRevision` is the one client-facing optimistic-concurrency token in this capability, and
its decoding is deliberately strict — see the `revisionField` comment in §8.

---

## 6 · How Persona composes with Context

### 6.1 The port

```ts
export interface PersonaContextRecordRef {
  readonly id: string;
  readonly revision: number;
}

export interface PersonaContextPort {
  declare(
    displayName: string,
    entries: ContextEntry[],
    options?: { readonly description?: string; readonly private?: boolean }
  ): Promise<PersonaContextRecordRef>;
  delete(id: string): Promise<void>;
  purge(id: string): Promise<void>;
}
```

— `ports/personaContext.ts:20-33`

Three methods. `ContextManager` (`3-capabilities/context/context.ts:28-59`) satisfies this
**structurally** — it has `declare(displayName, entries, options?): Promise<ContextRecord>` where
`ContextRecord` carries `id` and `revision`, plus `delete(id)` and `purge(id)`. There is no
adapter, no wrapper class, and no import of Context's concrete types by Persona beyond
`ContextEntry`. `startBackend.ts:64` passes the manager in as-is.

This is one of exactly two places in the backend that use structural satisfaction instead of an
adapter; the other is `DocumentCapability` satisfying `TemplatableResource` for
[Templates](templates.md). Both currently harbour a defect that the pattern makes easy to miss,
because the tests double the port (§9.1).

### 6.2 The private wrapper

Persona never stores a context reference as a bare entry. It declares a **private Context record**
that wraps the authored entry, and stores that record's id:

> ```
> /** The private wrapper's name is derived from the persona's immutable id, never
>  *  its editable display name, so a rename can never orphan or collide it. */
> ```
> — `personaService.ts:83-84`

`wrapperName(personaId)` is `` `persona:${personaId}` `` (`:85`). Wrappers are always declared with
`{ private: true, description: "Private scope wrapper for persona <displayName>" }`
(`:220-223`, `:393-396`).

`resolve()` puts the **wrapper** into the snapshot, not the authored entry:

```ts
    // The snapshot points at Persona's private wrapper, not the authored entry.
    // Consumers treat it as opaque and hand it to knowledge.resolveScope.
```

— `personaService.ts:498-499`

`sameContextEntry(a, b)` (`:90-93`) compares `id` and `kind` only, and its comment explains the
optimisation it enables:

> ```
> /** Whether two optional context references point at the same entry, so a
>  *  metadata-only edit that leaves the context untouched can skip any Context
>  *  write entirely. */
> ```
> — `personaService.ts:86-89`

### 6.3 `planWrapperChange` — the five transitions

`personaService.ts:374-403` returns a *plan* rather than performing the write, so the caller
controls ordering relative to the persona CAS.

| `contextWrapperId` before | `definition.context` after | Plan | Context calls |
| --- | --- | --- | --- |
| absent | absent | `unchanged` | none |
| present | present, same `{id, kind}` | `unchanged` | none |
| present | absent | `cleared` | `delete(previous)` **after** the CAS |
| absent | present | `set` | `declare(...)` **before** the CAS |
| present | present, **different** | `set` + `previousWrapperId` | `declare(...)` before the CAS, `delete(previous)` after |

**The last row is the one that always fails against the real `ContextManager`** — see §9.1.

### 6.4 Ordering in `create`, `delete` and `purge`

`create` (`:214-256`) generates the id first, declares the wrapper, then inserts the row:

```ts
    // The id is generated before the wrapper so the wrapper's name can be derived
    // from it. Context is called before the persona row is written; a failure
    // between the two leaves an orphaned private record, which is accepted — see
    // docs/invariants.md.
```

— `personaService.ts:214-217`

The insert is wrapped in a `try/catch` that logs `persona.wrapper.orphaned` at warn and rethrows
(`:245-256`).

`delete` (`:422-457`) reverses the order:

```ts
    // Delete the owned wrapper first. A retry tolerates an already-absent
    // wrapper, so a failure between the two databases is recoverable and a
    // successful Persona deletion can never leave a live wrapper behind.
```

— `personaService.ts:430-432`

Only `ContextNotFoundError` is swallowed, and it is matched **by `error.name` string**, not by
`instanceof` (`:441`) — see §9.6. Anything else aborts the deletion.

`purge` (`:459-471`) reads `store.latestSnapshot(id)` to recover the wrapper id from retained
history, calls `context.purge(wrapperId)` swallowing only `ResourceHistoryNotFoundError` (again by
`error.name`, `:466`), then `store.purge(id)`.

---

## 7 · Invariants

| Invariant | Enforced at |
| --- | --- |
| The built-in is immutable across update, delete and purge | `assertMutable`, `personaService.ts:187-189`, called first at `:284`, `:424`, `:460` |
| `resolve()` with no id always yields the built-in, even against an empty database | `personaService.ts:492-493` |
| `resolve()` on a deleted or unknown id throws rather than falling back | `personaService.ts:493-494` |
| Live display names are unique, case-insensitively | DB: `sqliteSchema.ts:52-53` (UNIQUE … COLLATE NOCASE); service precheck: `personaService.ts:203-205`, `:294-296` |
| At most `maxPersonas` live records | `personaService.ts:206-212` — **create only** |
| Update and delete require the exact current revision | `personaService.ts:286-288`, `:426-428`, plus the CAS at `sqlitePersonaStore.ts:128`, `:145`, `:170`, `:188` |
| A definition is replaced wholesale, never patched | `personaService.ts:302-305` |
| A definition must carry at least one non-empty section **or** a context reference | `validation.ts:132-137` |
| Section text is trimmed at ingress, so trailing whitespace never changes a digest | `validation.ts:112`, `:119` |
| Render order comes from `PERSONA_SECTION_NAMES`, never from the caller's selection order | `render.ts:22-26` |
| Empty or unselected sections are omitted together with their headings | `render.ts:25` |
| `definitionDigest` excludes `displayName`, `description` and the wrapper id | `canonical.ts:40-49` |
| `context_json` and `context_wrapper_id` are both null or both set | `sqliteSchema.ts:48-49` (a database CHECK) |
| The wrapper's name derives from the immutable id | `personaService.ts:85` |
| The wrapper is always `private: true` | `personaService.ts:221`, `:394` |
| A changed context never mutates the existing wrapper in place | `personaService.ts:393` (declare, not update) and the absence of `update` from the port |
| The superseded wrapper is deleted only after the persona CAS commits | `personaService.ts:342-346`, after `:324` |
| A successful delete can never leave a live owned wrapper | `personaService.ts:433-443` — wrapper first, only `ContextNotFoundError` tolerated |
| The wire layer rejects unknown keys | `wire/common.ts:13-23`, applied in every decoder branch |
| `expectedRevision` must be a genuine non-negative integer | `wire/common.ts:52-62` |
| Section text never enters a log record | asserted by `persona-wiring.test.ts:278-299` |

### 7.1 Logging

| Event | Level | Fields | Site |
| --- | --- | --- | --- |
| `persona.runtime.created` | info | `{}` | `personaService.ts:536` |
| `persona.command` | debug | `type, durationMs` — emitted in a `finally`, so it fires on throw too | `:128-133` |
| `persona.query.completed` | debug | `type, durationMs` plus `personaId` \| `count` \| `promptDigest` | `:142`, `:152`, `:161`, `:172` |
| `persona.create` | info | `personaId, revision, definitionDigest, sectionCount, hasContext, durationMs` | `:258-265` |
| `persona.update` | info | `personaId, revision, definitionDigest, digestChanged, durationMs` | `:348-354` |
| `persona.delete` | info | `personaId, revision, durationMs` | `:452-456` |
| `persona.purge` | info | `personaId` | `:470` |
| `persona.resolve` | debug | `personaId, revision, definitionDigest, promptDigest, sectionCount, promptChars, hasContext, isBuiltIn, durationMs` | `:517-527` |
| `persona.wrapper.declared` | info | `personaId, wrapperId, revision` | `:226-230`, `:397-401` |
| `persona.wrapper.deleted` | info | `personaId, wrapperId` | `:412`, `:436-439` |
| `persona.wrapper.orphaned` | warn | `personaId, wrapperId, reason` | `:249-253`, `:331-335`, `:414-418` |
| `persona.command.failed` / `persona.query.failed` | error | `requestId, errorName, errorMessage` — **5xx only** | `registerPersonaEndpoints.ts:83`, `:103` |

`get`, `getByName` and `list` log nothing of their own; they are visible only through
`persona.query.completed` when reached via `query()`. Persona emits no content-labelled records: it
logs digests, counts and character *lengths*, never section bodies, display names or descriptions.

---

## 8 · Design decisions worth preserving

**One array is the single source of section order.**

```ts
/**
 * The five sections of a definition, in render order. This array is the single
 * source of that order — the renderer and the wire decoder both read it, so a
 * section cannot be added in one place and forgotten in the other.
 */
```

— `domain/model.ts:9-13`

**The render contract, stated as five bullets and one warning.**

```ts
/**
 * Render the selected, non-empty sections.
 *
 * - fixed order, independent of the order sections were selected in;
 * - a section that is empty, or not selected, is omitted with its heading;
 * - each body is trimmed; internal blank lines are preserved as authored;
 * - sections are joined by exactly one blank line; there is no trailing newline;
 * - the context reference is never rendered — it is scope, not text.
 *
 * A definition carrying only a context reference renders to an empty string.
 * Consumers must tolerate that and omit the message rather than sending a blank
 * system turn.
 */
```

— `domain/render.ts:29-41`

**Selection order cannot reorder a persona.**

```ts
/**
 * Which sections would actually appear, in fixed render order.
 *
 * Order comes from PERSONA_SECTION_NAMES, never from the caller's selection
 * order — a consumer cannot reorder a persona by shuffling its section list.
 */
```

— `domain/render.ts:11-16`

**The digest answers exactly one question.**

```ts
/**
 * Identity of a persona's behaviour.
 *
 * Covers exactly the five sections plus the authored context reference. It
 * excludes displayName and description on purpose: renaming a persona or editing
 * its catalog blurb bumps `revision` but leaves this digest alone, so the digest
 * keeps answering one question — did the behaviour change?
 *
 * It also excludes the private wrapper id, which is Persona's own bookkeeping and
 * would otherwise make two behaviourally identical personas digest differently.
 */
```

— `domain/canonical.ts:29-39`

**A duplicated canonicaliser, deliberately.**

```ts
// Canonical serialisation and digests for Persona.
//
// A standalone copy owned by this capability, matching the house rule against
// premature type sharing. Document carries an equivalent helper; the two are
// deliberately independent so neither constrains the other's canonical form.
```

— `domain/canonical.ts:1-5`

**A definition must mean something.**

```ts
/**
 * Validate and canonicalise a definition.
 *
 * Section bodies are trimmed on the way in, so trailing whitespace never changes
 * a digest. A definition must carry something: at least one non-empty section, or
 * a context reference. Five empty sections and no context means nothing and
 * renders to nothing, so it is rejected. Five empty sections *with* a context is
 * legal — a pure scope persona is a real persona.
 */
```

— `domain/validation.ts:79-87`

**The freeze exists so a consumer never silently gets a different persona.**

```ts
  /**
   * Absent id resolves the built-in. A deleted or unknown id throws rather than
   * falling back, so a consumer never silently gets different behaviour than the
   * one it named.
   */
```

— `application/personaService.ts:75-79`

**Total switches are a compile-time guard.**

```ts
  // Total switches with no default clause: adding a command or query variant is a
  // compile error until it is handled here.
```

— `application/personaService.ts:107-108`

**A strict revision decoder, because the alternative produces a lie.**

```ts
/**
 * A revision must arrive as a genuine non-negative integer.
 *
 * Deliberately strict: coercing a missing value with Number() yields NaN, which
 * compares unequal to every stored revision and surfaces a malformed request as a
 * misleading revision conflict. A client retrying on 409 would retry forever.
 */
```

— `wire/common.ts:45-51`

**Unknown keys are a client error, not a dropped field.**

```ts
/** Rejects unknown keys, not just missing ones. A client typo is a 400, not a
 *  silently dropped field. */
```

— `wire/common.ts:11-12`

**Two layers reject, and neither trusts the other.**

```ts
/**
 * Decode a definition's shape only.
 *
 * Section lengths, the at-least-something rule, and context-entry field types are
 * validated in the domain, so this layer proves the payload is structurally a
 * definition and hands the rest over. Both layers reject; neither trusts the other.
 */
```

— `wire/common.ts:88-94`

**The port names what it does *not* take, and why.** This is the record of the partial-write fix
made in `1cbe845`, and the most valuable comment in the capability:

```ts
// The narrow slice of Context that Persona consumes.
//
// Satisfied structurally by ContextManager, which has many more methods. Persona
// states exactly what it uses: it manages one private wrapper record per persona
// and never reads Context for any other reason. There is deliberately no get(),
// resolve(), combine(), or list() here — expanding a context reference into
// retrievable content is the consumer's job, not Persona's.
//
// There is also no update(). A changed context is never applied by mutating the
// existing wrapper in place — Persona always declares a brand-new wrapper and,
// once its own record's CAS write has committed to the new wrapper, deletes the
// old one. A fresh declare() can never itself go stale (it always starts at
// revision 1), which is what makes this ordering immune to the partial-write
// gap described in docs/invariants.md: either side losing its race leaves, at
// worst, one harmless orphaned wrapper — never a persona record pointing at a
// stale or missing one.
```

— `ports/personaContext.ts:1-16`

As originally shipped in `61c292f`, the port had a fourth method `update(id, entries,
expectedRevision)` and the service called it **before** the persona row's CAS. Two failure modes
followed: a lost persona CAS left a wrapper that had already been mutated in place — a genuine
partial write across two databases — and `existing.contextWrapperRevision ?? 1` could itself be
stale, failing the Context update mid-mutation. `1cbe845` removed `update`, added `purge`, replaced
`reconcileWrapper` with `planWrapperChange`, and moved wrapper deletion to *after* the persona CAS.

**The plan, and what a lost race costs.**

```ts
  /**
   * Decide what the persona's private wrapper should become for the incoming
   * definition, declaring a fresh wrapper up front when one is needed.
   *
   * A changed or newly-added context is never applied by mutating the existing
   * wrapper in place — a brand-new wrapper is declared instead (declare() always
   * starts at revision 1, so this step can never itself go stale). The persona's
   * own CAS write, made by the caller right after this returns, is what decides
   * whether the new wrapper takes effect; the old wrapper (if any) is only
   * deleted once that CAS has committed. If the CAS is lost, the freshly
   * declared wrapper here is simply abandoned as a harmless orphan and the
   * caller retries the whole operation against fresh state — the old wrapper,
   * untouched, is still exactly what the (unchanged) persona record points at.
   * This ordering is what keeps a lost race from ever leaving the persona
   * record pointing at a stale or missing wrapper (see docs/invariants.md).
   */
```

— `application/personaService.ts:358-373`

```ts
      // The persona row lost its revision race. A wrapper freshly declared just
      // above for this attempt is now unreferenced — it is never adopted by any
      // record, so it is simply abandoned rather than repaired; the caller
      // retries the whole operation against fresh state, and any *previous*
      // wrapper (if this was a swap or removal) is untouched and still valid.
```

— `application/personaService.ts:325-329`

```ts
  /** Best-effort cleanup of a wrapper that is no longer referenced by any
   *  persona record. A failure here does not undo or fail the mutation that
   *  already committed — it just leaves an inert, harmless orphan, logged so
   *  it is visible rather than silent. */
```

— `application/personaService.ts:405-408`

**Orphans are accepted, explicitly, at creation too.**

```ts
    // The id is generated before the wrapper so the wrapper's name can be derived
    // from it. Context is called before the persona row is written; a failure
    // between the two leaves an orphaned private record, which is accepted — see
    // docs/invariants.md.
```

— `application/personaService.ts:214-217`

**The schema justifies columns over a blob.**

```ts
  // Sections are columns rather than one definition blob: the schema is fixed and
  // known, so "which personas mention retrieval" stays a plain query instead of
  // JSON extraction. The context reference is a single nullable JSON object
  // because it is a two-field value, not a list.
```

— `persistence/sqliteSchema.ts:27-30`

**The built-in is a constant, not a seeded row.**

```ts
// The built-in fallback persona.
//
// A code constant at revision 0. Not a table row, not editable, not deletable,
// and always resolvable — including against an empty database. Its purpose is to
// make consumers total without requiring a seeded row or a migration.
```

— `domain/builtin.ts:1-5`

---

## 9 · Known gaps and defects

### 9.1 DEFECT — changing a persona's context reference always returns HTTP 500

**What happens.** `planWrapperChange` declares the replacement wrapper under the **same
deterministic name** as the still-live old one — `` `persona:${existing.id}` ``
(`personaService.ts:393`, via `wrapperName(existing.id)`) — because the old wrapper is deliberately
only deleted *after* the persona CAS commits (§6.3, §6.4).

But `ContextManager.declare` rejects a duplicate live display name:

```ts
const existing = this.store.getByName(displayName);
if (existing) throw new ContextConflictError(displayName);
```

— `3-capabilities/context/context.ts:115-116`

and Context's current table is live-only with an exact-match `getByName`
(`3-capabilities/context/sqlite-store.ts:79-84`). So the "context present → different context
present" transition — the last row of the table in §6.3 — throws `ContextConflictError` before the
persona row is ever touched.

**Why it is a 500.** `ContextConflictError` is **not** among the eight rungs of
`registerPersonaEndpoints`'s error ladder (§4.1), so it falls through to
`{ statusCode: 500, body: { error: "internal_error", message: "Persona operation failed" } }` and
logs `persona.command.failed`.

**Blast radius.** No state is corrupted: the throw happens before the persona CAS, so the persona
row and the existing wrapper are both untouched. It is a hard, repeatable failure, not a partial
write. The other four transitions in §6.3 all work. A caller can work around it in two commands —
update to **remove** the context (which deletes the wrapper and frees the name), then update again
to add the new one.

**Why no test catches it.** Both suites substitute a `PersonaContextPort` double whose `declare`
never checks names:

- `persona.test.ts:66-74` — `createFakeContext().declare` records the call and returns
  `{ id: "wrapper-<n>", revision: 1 }` unconditionally;
- `persona-wiring.test.ts:38-45` — `createNoopContext().declare` returns the same, with no
  bookkeeping at all.

`persona.test.ts` test 23 (*"changing a persona's context declares a fresh wrapper and deletes the
old one"*) therefore passes against a double that permits what the real collaborator forbids. This
is the failure mode of structural satisfaction: the port is satisfied by a real object in
production and by a permissive double in tests, and nothing compares the two.

The module's own docs name the exact seam the bug sits in:

> *"Not covered: Persona against a *real* `ContextManager` (the wrapper tests use a double), and
> any consumer integration — there is no consumer yet."*
> — `src/3-capabilities/persona/docs/invariants.md:161-162`

Recorded in [11-known-issues.md](../11-known-issues.md).

### 9.2 `resolve()` has no production consumer

The freeze is the capability's headline mechanism and nothing calls it.
`grep -rn` over `src/` finds `resolve` only in its own definition and its own log line; the
only callers are `persona.test.ts` tests 18, 19, 30, 31 and 32. There is no `resolve` endpoint, and
no capability imports `#persona` — the alias appears in exactly two files, both Persona's own
composition and wiring.

The module states this plainly and should be believed:

> *"There is **no consumer yet**. Derived Outputs is unchanged, and Agents does not exist.
> `resolve()` is exercised only by tests. The snapshot shape is the contract Agents will be built
> against."*
> — `src/3-capabilities/persona/docs/README.md:23-25`

`render()` likewise has no in-process consumer other than the `persona.render` query.

### 9.3 `contextWrapperRevision` is vestigial

The column exists, the field is written and read, and **nothing compares or CAS-es on it**. Since
`1cbe845` removed `context.update`, its only remaining purpose — an optimistic-concurrency token
for a wrapper mutation — no longer exists, and `declare` always returns revision 1, so the field
records `1` for every wrapper. It is also the one wrapper field the schema `CHECK` does not
constrain (§5.1).

### 9.4 `normalizeDisplayNameKey` is a dead export

`domain/validation.ts:31-32`, re-exported from `index.ts:18`, never called anywhere in `src/` or
`test/`. Case-insensitive uniqueness is enforced by the SQLite `COLLATE NOCASE` index and by two
service-level `getByName` prechecks that pass the raw name; the normaliser is unused by both. (The
same identifier exists in Structured Data as an unrelated function.) Listed in the repository-wide
dead-surface inventory in [11-known-issues.md](../11-known-issues.md).

### 9.5 The composition docblock describes a port that no longer exists

`1-init/create/persona.ts:12-16` claims *"Persona uses only declare/update/delete"*.
`PersonaContextPort` has **no `update`** — it has `declare`, `delete` and **`purge`**
(`ports/personaContext.ts:25-33`). `update` was removed and `purge` added in the same commit,
`1cbe845`, and this comment was not updated. It is the stale mirror image of the very fix it should
describe.

### 9.6 Error identity by string

`personaService.ts:441` matches `error.name === "ContextNotFoundError"` and `:466` matches
`error.name === "ResourceHistoryNotFoundError"`, rather than `instanceof`, to avoid importing
Context's error classes across the capability boundary. Renaming either class silently breaks the
tolerate-on-retry paths — the `catch` stops swallowing and the deletion or purge starts failing.
Document does the same at `documentService.ts:229` (`DerivedOutputNotFoundError`) and `:976`
(`ResourceHistoryNotFoundError`). Those four sites are the only cross-capability error matches by
name in the backend; every other handler uses `instanceof`.

### 9.7 A genuinely concurrent create races into a 500

The service precheck (`getByName`, `personaService.ts:203-205`) produces the typed
`PersonaConflictError` → 409 on the ordinary path. Two simultaneous creates of the same name would
instead surface the raw SQLite `UNIQUE` constraint error, which the ladder maps to 500. The serial
queue makes this unreachable over HTTP today, since both creates arrive on `POST /personas/command`.
The module's `docs/invariants.md:61-63` states and accepts this.

### 9.8 Deliberate absences

Each of these is recorded as a decision in the module's own `docs/README.md:38-52`, and each is
worth knowing before building on Persona:

| Absent | Consequence |
| --- | --- |
| **No command-receipts table, no idempotency** | A retried `persona.create` creates a second persona, or 409s on the name. Update and delete are protected by `expectedRevision` instead |
| **No Activity publication** | Persona changes are invisible in the ledger. Doing it correctly would need an outbox row in the same transaction as the mutation |
| **No project default persona pointer** | A consumer that wants a default stores a persona id in its own configuration. The stated reason: a mutable global pointer *"would silently change the behaviour of every future task — the action-at-a-distance the freeze model exists to prevent, reintroduced one layer up"* |
| **No config section** | Limits live only in `DEFAULT_PERSONA_LIMITS`; there is no `persona:` YAML block and no override path in production |
| **No `resolve` endpoint** | The freeze is in-process only, and there is no in-process consumer (§9.2) |

### 9.9 The connection is never closed

`SQLitePersonaStore` has no `close()` at all — not on the port, not on the class. Shutdown
(`startBackend.ts:220-227`) exits with the handle open. Backend-wide; see
[11-known-issues.md](../11-known-issues.md).

### 9.10 Module-doc drift

| File:line | Claim | Reality |
| --- | --- | --- |
| `docs/invariants.md:123-125` | *"**A no-op definition resubmit still bumps the wrapper's revision.** Definitions are replaced wholesale and Persona does not diff prose, so `update` with an unchanged context still calls `context.update`."* | Doubly wrong. `context.update` does not exist on the port, and `planWrapperChange` returns `{kind:"unchanged"}` when `sameContextEntry` holds (`personaService.ts:387`), so an unchanged context makes **zero** Context calls — proven by `persona.test.ts` test 24. The same file contradicts itself 20 lines earlier at `:101-103`, which is correct. The paragraph is a leftover from before `1cbe845` |
| `docs/runtime.md:41-53`, `docs/flows.md` | The wrapper table's "present → present, different" row describes `declare` for a new wrapper with the old one deleted after the CAS | An accurate description of the *code*, but the docs assert this path works. Against the production `ContextManager` it always throws (§9.1). No doc records the defect |
| `docs/README.md:27-31` | The warning about `docs/capabilities-old/persona.md` | **Correct** — recorded here as a verified-accurate self-critical statement worth preserving, not as drift |

### 9.11 Coverage

Forty-three tests across two files, all passing — the third-best-covered area in the backend after
Templates and Slides.

`persona.test.ts` (32) covers rendering order, omission and trimming; the empty-render case; digest
stability and sensitivity; the at-least-something rule; limits; case-insensitive name uniqueness;
logical delete and name release; guarded purge including the Context wrapper; revision CAS on
update and delete; name-sorted listing; built-in resolution and immutability; all five wrapper
transitions; the lost-race orphan path; the failed-cleanup orphan path; that reads and `resolve`
never touch the Context port; and that a snapshot is immune to later edits.

`persona-wiring.test.ts` (11) covers alias availability, the serial/concurrent split, a
command-then-query round trip, the pure render query, unknown-field rejection, the missing
`expectedRevision` 400, the typed-error→status mapping, log hygiene, `runtime.created`,
`query.completed` on every query, and wrapper declare/delete logging.

Neither file touches `pruneHistory` or `purgeExpired`
(`grep -n 'pruneHistory\|purgeExpired' test/capabilities/persona*.test.ts` → no matches), so
Persona's retention path — including the `purgeExpired` loop that purges each owned Context wrapper
— is covered only generically by `resource-retention.test.ts` against the shared helper.

The gap that matters is stated in §9.1 and by the module itself: **nothing exercises Persona
against a real `ContextManager`**, and a live defect is sitting in that gap.

---

## See also

- [07-capabilities/README.md](README.md) — the capability inventory
- [context.md](context.md) — the collaborator behind `PersonaContextPort`, and where `ContextConflictError` is raised
- [templates.md](templates.md) — the other structural-satisfaction seam, with its own defect in the same shape
- [comments.md](comments.md) — the same `exactKeys` wire discipline, without a client-facing `expectedRevision`
- [04-state-and-persistence.md](../04-state-and-persistence.md) — the shared history table and the retention sweep
- [11-known-issues.md](../11-known-issues.md) — the context-swap 500 and the dead exports
