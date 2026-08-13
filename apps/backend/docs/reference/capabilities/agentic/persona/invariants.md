# Persona invariants, guarantees, and limits

## Implemented precondition → outcome contracts

| Preconditions | Guaranteed outcome | Enforcement boundary |
|---|---|---|
| `create` receives a valid definition and no live name conflict, under `maxPersonas` | A UUID record at revision 1 is inserted, with a private wrapper iff the definition carries a context | Service checks plus the SQLite live-name unique index |
| `update` sees a live record whose revision equals `expectedRevision` | Supplied fields replace their predecessors, the wrapper is reconciled, and the record is stored at revision + 1 | Service read/check, then a single-statement CAS |
| `update`/`delete` lose a revision race | `StalePersonaRevisionError`, no write | `WHERE id = ? AND revision = ?`, `changes === 1` |
| `delete` succeeds | The wrapper is logically deleted, the final Persona snapshot plus terminal revision are retained, and no current Persona row remains; the display name is immediately reusable | Context service, then one Persona history/current transaction |
| `purge` targets a deleted Persona | The owned wrapper history and all Persona history are physically removed | Service ownership ordering plus Context and Persona purge guards |
| `render` is called twice with the same definition and selection | Byte-identical output | Pure function over values |
| `resolve()` with no id, against an empty database | The built-in snapshot at revision 0 | Code constant, no store read |
| `resolve(id)` for a deleted or unknown id | `PersonaNotFoundError` — never a silent fallback to the built-in | Service |
| `update`/`delete` targeting `builtin:default` | `BuiltInPersonaImmutableError` | Service guard before any store access |

## Rendering rules

Exactly, and all covered by tests:

- Section order is `focus, background, approach, outputPreferences, verification`, taken
  from `PERSONA_SECTION_NAMES` and **independent of the order sections were selected in**.
- A section that is empty, whitespace-only, or unselected is omitted **with its heading**.
- Each body is trimmed; internal blank lines are preserved as authored.
- Sections are joined by exactly one blank line. There is no trailing newline.
- The context reference is never rendered — it is scope, not text.
- A definition carrying only a context reference renders to `""`.

## Digest rules

- `definitionDigest` covers the five sections plus the authored context reference, with
  object keys sorted and `undefined` values dropped, so it is stable across key
  reordering.
- `definitionDigest` **excludes** `displayName`, `description`, and `contextWrapperId`. A
  rename or blurb edit bumps `revision` and leaves the digest alone.
- `definitionDigest` changes on any section edit or context-reference change.
- `promptDigest` covers the rendered bytes, so it varies with section selection while
  `definitionDigest` does not.

## Identity, name, and revision rules

- Record IDs are random UUIDs and are immutable.
- Live display-name uniqueness is project-wide and **case-insensitive**, enforced by
  `UNIQUE INDEX … (display_name COLLATE NOCASE)` on the current-only table.
- `revision` starts at 1 and increments by exactly one per accepted update; logical
  deletion writes terminal revision `N + 1`. The built-in is revision 0 and can never be
  written.
- The wrapper's Context record name is `persona:<personaId>`, derived from the immutable
  id and never from the editable display name.
- `context_json` and `context_wrapper_id` are both null or both set — enforced by a
  SQLite `CHECK`, so "a context with no wrapper" is unrepresentable.

## Concurrency and atomicity

Persona does **not** open a transaction spanning the Context call and its own write.
Guarantees that do hold:

- `update` is a transactional compare-and-swap that archives the old current snapshot;
  `delete` compares the same current revision before its history/current transaction. A
  losing writer changes no Persona state and receives `StalePersonaRevisionError`.
- The live-name unique index is the final arbiter for names, even when two creations race;
  the service precheck produces the typed `PersonaConflictError` in the ordinary path,
  while a genuine race surfaces a raw SQLite constraint error mapped to 500.
- All command endpoints share the **serial** queue, so in the deployed runtime these
  operations do not actually interleave. The CAS is defence in depth, not the only guard.

## Non-guarantees, stated plainly

**Create and update races can, at most, orphan a private wrapper; a completed mutation
never leaves a current Persona pointing at a stale or missing one.** The Persona row's
own CAS write is the point that adopts a freshly declared update wrapper. Superseded
wrappers are cleaned up only after that CAS:

- `create` declares the wrapper, then inserts the persona row. If the insert fails, the
  wrapper is orphaned — logged as `persona.wrapper.orphaned` (`warn`) — and the caller
  simply retries the whole operation; there is no persona row yet to reconcile against.
- `update`, when the context reference is added or changed, never mutates an existing
  wrapper in place. It always declares a brand-new one first, then CAS-writes the
  persona row to point at it. If that CAS is lost, the freshly declared wrapper is
  abandoned (`persona.wrapper.orphaned`, `warn`) and the caller retries with fresh
  state — any previous wrapper is untouched and still exactly what the (unchanged)
  persona record points at. If the CAS succeeds, the previous wrapper (if any) is
  deleted afterward as best-effort cleanup; a failure there also just orphans it
  (logged, not thrown — the persona update itself already committed).
- `delete` deletes the owned wrapper first, then archives and removes the Persona current
  row. Missing-wrapper errors are tolerated for exact retry; other wrapper failures stop
  deletion. A failure after wrapper deletion but before the Persona transaction leaves a
  recoverable intermediate state, and retry completes without leaving a live wrapper.

An orphaned private wrapper from create/update is harmless beyond disk usage: private
(never listed), and by construction unreferenced by any live persona record. Logical
Persona deletion does not accept that outcome: it requires the owned wrapper deletion to
succeed before removing the Persona current row.

The create/update ordering is also safe under genuine concurrency, not just crash-only:
two callers racing the same Persona each declare their own fresh wrapper independently,
and only one wins the Persona-row CAS. The loser's wrapper is simply orphaned and logged.
Delete relies on the deployed serial command queue to avoid racing an update across its
two databases; its interruption window is recovered by exact retry.

**A metadata-only edit that leaves the context reference unchanged makes no Context
call at all.** `update` compares the incoming context entry against the persona's
current one and only declares a new wrapper when it actually differs.

**A deleted referenced context degrades silently, one hop later.** Context's `resolve`
omits missing ids rather than erroring. If the entry Persona wrapped is itself deleted,
the wrapper still exists and still resolves but contributes no material — the same failure
mode as before wrapping, just observed through the wrapper. The consumer's scope manifest
is where this is visible. Persona could now detect it (it holds a Context dependency) but
deliberately does not, since the check would cost a read on every resolve.

**A composed context is a frozen enumeration.** "The whole project except X" is
expressible only by enumerating the project at compose time, so a document added tomorrow
will not appear in it. `resolveScope([])` does mean live whole-project, but `[] minus X`
cannot be expressed. Fixing this properly needs an exclusion primitive on the Context
side. Until then, an author wanting an exclusion scope to stay current must re-compose and
re-point the persona.

**The wrapper is an alias, not a copy.** It holds the author's entry unmodified, so it adds
a hop rather than a guarantee. A real snapshot — expanding `context.resolve()` at wrap time
and freezing the leaves — is a natural next step and is deferred.

**A no-op definition resubmit still bumps the wrapper's revision.** Definitions are
replaced wholesale and Persona does not diff prose, so `update` with an unchanged context
still calls `context.update`.

## Limits

| Limit | Default | Applied to |
|---|---:|---|
| `maxSectionChars` | 4,000 | Each section body, after trimming |
| `maxDefinitionChars` | 12,000 | The five sections summed |
| `maxDisplayNameChars` | 120 | Trimmed display name |
| `maxDescriptionChars` | 500 | Description |
| `maxPersonas` | 500 | Live records, checked on create only |

`maxPersonas` is checked on create and not on any other path, so a project cannot exceed
it by creating but could sit above it if the limit were lowered later.

## Security and scope

- The project table prefix is a deterministic SHA-256 fragment of the configured
  `projectId`, computed once at construction. No request can select a project or table.
- Persona is authorization-neutral. It does not authenticate access to the resources its
  context reference names; a frozen Knowledge scope adds membership checks downstream.
- **Section text, prompts, display names, and descriptions never enter a log record.**
  There is a regression test asserting this.
- A persona fragment is advisory text appended after a consumer's own system content. An
  author editing a persona cannot dissolve a task's contract — but this is a rule
  *consumers* must keep, and Persona cannot enforce it. It returns a fragment rather than
  a system prompt specifically so that no consumer is tempted to treat it as one.

## Test coverage and non-goals

`persona.test.ts` covers
rendering, digests, validation, persistence, the built-in, and the full wrapper lifecycle
against a fake `PersonaContextPort`;
`persona-wiring.test.ts` drives a
real transport, registry, and scheduler.

Not covered: Persona against a *real* `ContextManager` (the wrapper tests use a double),
and any consumer integration — there is no consumer yet.

Current non-goals: Library kernel, library/local split, version table, project default
pointer, persona composition or stacking, variables or templating inside sections, cast or
model selection, tool policy, Activity publication, history-to-current replay, and
per-user personas.
