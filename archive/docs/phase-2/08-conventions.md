# 08 · Conventions

*Verified against source at commit ef6d462, 2026-08-09.*

Idioms observed consistently enough to be treated as house style, each re-checked against source
at HEAD. Where a convention is stated and then broken somewhere, both facts are here — the
exceptions are as useful as the rules.

The superseded page is at
[phase-1/claude-notes/08-conventions.md](../phase-1/claude-notes/08-conventions.md). Most of it
held up; three claims did not, and they are corrected below (`--test-concurrency=1`, the
`readonly` split, the section-divider rule).

---

## Naming

| Thing | Convention | Example |
| --- | --- | --- |
| Directories | `kebab-case` | `derived-outputs`, `general-files`, `rich-text`, `structured-data` |
| Files | `camelCase` in layered capabilities, `kebab-case` or single-word in flat ones | `documentService.ts` vs `sqlite-store.ts` |
| Capability factories | `create<Name>Capability` / `create<Name>Service` / `create<Name>Runtime` | `createDocumentCapability`, `createConnectorService`, `createInvestigationRuntime` |
| `1-init` factories | `create<Thing>Instance` when the bare name is taken, `create<Thing>` when it is not | `createStructuredDataInstance`, `createLogger` |
| Runtime interfaces | `<Name>Capability` / `<Name>Service` / `<Name>Manager` / `<Name>Runtime` | `DocumentCapability`, `ConnectorService`, `ContextManager`, `InvestigationRuntime` |
| Store ports | `<Name>Store` (file is sometimes `repository.ts`) | `DocumentStore`, `GeneralFileStore`, `DataStore` |
| SQLite adapters | `SQLite<Name>Store` | `SQLiteDocumentStore`, `SQLiteConnectorStore` |
| Wire decoders | `decode<Thing>` | `decodeDocumentCommand`, `decodeTemplateQuery` |
| Projections | `project<Thing>` | `projectDocumentOutline` |
| Errors | `<Problem>Error`, one class per failure mode, `this.name` set explicitly | `RevisionConflictError`, `TemplateNameConflictError` |
| Log events | `dot.separated.lowercase`, hyphens inside a segment | `document.internal-stage.retrying`, `templates.register.detail` |
| Wire error codes | `snake_case` | `revision_conflict`, `identity_reuse`, `not_deleted` |
| Operation / command types | `dot.separated` namespaced | `block.insert`, `prompt.create.request`, `template.instantiate` |
| Kind strings | `::`-separated when compound | `general::file::text`, `connector::file::text`, `slides::deck` |
| Table prefixes | `<abbrev>_<sha256(projectId)[0:16]>` | `doc_`, `tpl_`, `inv_`, `gf_`, `cmt_` |

Of 236 source files, 82 use `camelCase` and 15 contain a hyphen; the rest are single lowercase
words (`model.ts`, `errors.ts`, `index.ts`, `context.ts`). The split tracks shape: every layered
capability uses `camelCase` multi-word filenames (`documentService.ts`,
`sqliteGeneralFileRepository.ts`), and the three flat/hybrid ones use `kebab-case`
(`sqlite-store.ts`, `derived-outputs.ts`, `structured-data.ts`). `1-init/create/` is mixed —
`connectorSyncScheduler.ts` and `generalFiles.ts` beside `formula-name-resolver.ts` and
`resource-reader.ts`. Match whichever the surrounding directory already uses.

There are **302 distinct log event names** in `src/`. Every one follows the dot convention.

---

## Types

- **`interface` for object shapes, `type` for unions.** Discriminated unions on a `type` or `kind`
  field are everywhere: `DocumentOperation` (39 variants), `DocumentCommand` (9), `ContextEntry`,
  `CellValue`, `TemplateCommand`, `JobDefinition`.
- **`readonly` discipline is not uniform, and the split is not "flat vs layered".** It tracks
  whether the type is *reduced over*:

  | `readonly` count | File |
  | ---: | --- |
  | 107 | `investigation/domain/model.ts` |
  | 75 | `derived-outputs/domain/model.ts` |
  | 67 | `templates/domain/model.ts` |
  | 58 | `persona/domain/model.ts` |
  | 31 | `structured-data/types.ts` |
  | 25 | `connector/domain/model.ts` |
  | 15 | `context/types.ts` |
  | 13 | `general-files/domain/model.ts` |
  | 2 | `comments/domain/model.ts` |
  | **0** | `activity/domain/model.ts` |
  | **0** | `document/domain/model.ts` (775 lines) |
  | **0** | `slides/domain/model.ts` (897 lines) |

  Document and Slides are the two aggregates with a reducer that builds new snapshots by mutating
  a `structuredClone`; making the model `readonly` would fight that. Everything else should be
  `readonly`.
- **`satisfies` for exhaustive record literals** — 10 uses in `src/`, e.g.
  `document/application/createService.ts:98`:
  ```ts
  } satisfies Record<DocumentBlockKind, string>;
  ```
  and `document/wire/valueSchemas.ts:366`:
  ```ts
  ] as const satisfies readonly DocumentBlockKind[];
  ```
- **`Record<Union, …>` as a completeness gate.** `OPERATION_KEYS: Record<DocumentOperation["type"],
  readonly string[]>` (`document/wire/operationSchemas.ts:50`) forces one decoder entry per
  operation variant. Adding a variant without a decoder entry is a compile error. Note the limit:
  it checks that a key exists, not that the listed field names are right.
- **Total switches over unions with no `default`.** Prefer this over a defensive default so that
  adding a union member is a compile error until every site handles it.
- **Conditional spread for optional properties**, never `undefined` assignment. This is
  load-bearing, not cosmetic: canonical digests are taken over the object and `JSON.stringify`
  drops `undefined` keys, so `name: undefined` and an absent `name` would digest identically while
  meaning different things.
  ```ts
  ...(transaction.compensation ? { compensation: transaction.compensation } : {})
  ```
- **`import type` for every cross-capability type.** Every cross-capability import inside
  `3-capabilities` is `import type`; the only value-level cross-module import is Document pulling
  `formatFormulaValue` / `toWire` from `#formula`, and Formula is `0-platform`.

---

## Functions

- **Both arrow-function consts and `function` declarations are exported, and the split is not
  principled.** 310 `export const … = (…) =>` versus 102 `export function` across 42 files. The
  `export function` files are: all of Formula (14) and Rich Text (10), four Knowledge
  lattice/windowing helpers, `1-init/create/formula-name-resolver.ts`, six capabilities (Connector,
  Context, Derived Outputs, General Files, Investigation, Structured Data — 8 files) and five
  job-wiring files. Everything else uses the arrow const. Match the file you are editing.
- **Classes are private.** In `src/3-capabilities` there are 92 `export class` declarations: **79
  error classes, 12 `SQLite*Store` adapters, and one service class**
  (`DerivedOutputServiceImpl`, which is nonetheless kept off its barrel). Platform is the other
  exception: `Knowledge`, `Intelligence`, `ToolSet`, `OpenRouterProvider`, `FileLogger`,
  `NoopLogger`, `JobScheduler`, `JobRegistry`, `SchedulerInternalJobsRuntime`,
  `ResourceRetentionScheduler`, `ConnectorSyncScheduler`, `StreamWindower`, `Xorshift`,
  `IntelligenceEmbedder`, `SQLiteKnowledgeStore`.
- **Stores are synchronous where SQLite is synchronous.** Seven store ports are sync —
  `ConnectorStore`, `ContextStore`, `DataStore`, `DerivedOutputStore`, `GeneralFileStore`,
  `InvestigationStore`, `TemplateStore` — each with the reason in the file header
  (`context/store.ts:2`: *"All methods are synchronous (SQLite is synchronous)."*). Five return
  `Promise`: `ActivityStore`, `CommentStore`, `DocumentStore` (49 methods), `PersonaStore`,
  `SlidesStore` (40 methods). Both are acceptable; the async ones keep the door open for a
  non-SQLite backend, at the cost of `await`ing a synchronous call.
- **Time.** `const now = (): string => new Date().toISOString();` appears in Document, Connector,
  General Files and Investigation. Activity, Comments, Templates and Persona instead inject a
  clock (`ActivityClock`, `CommentClock`, `TemplateClock`, `PersonaClock`) defaulting to a module
  `systemClock`. **Inject the clock** — it is what makes the retention and TTL tests deterministic.
- **Identifiers.** `randomUUID()` from `node:crypto`, injectable as a `createId` factory parameter
  in Comments and Templates. Deterministic-ID capabilities compute instead: General Files uses
  `sha256(content)`, Connector `sha256(provider + locator)`, Activity `act_<sha256(idempotencyKey)>`.

---

## Errors

- One typed class per distinguishable failure, in `domain/errors.ts` (or `types.ts` /
  `domain/model.ts` for the flat capabilities and Investigation), each setting `this.name`
  explicitly and carrying the relevant IDs as public readonly constructor properties.
- **Domain throws typed errors; job wiring maps them to HTTP.** Domain code never mentions a status
  code. The ladder is described in
  [03-capability-anatomy.md](03-capability-anatomy.md#7--the-error--status-ladder).
- **Never leak internals on 500.** Log the real name, return a fixed generic message. From
  `4-job-wiring/persona/registerPersonaEndpoints.ts:45-46`:
  ```ts
  // Internal errors never leak detail to the client; the real message is logged.
  return { statusCode: 500, body: { error: "internal_error", message: "Persona operation failed" } };
  ```
  **Six wiring files obey this** (document, templates, comments, persona, activity,
  investigation). **Two return `e.message` on the 500 path** (connector, general-files). **Three
  have no 500 rung at all** and fall through to `400 bad_request` with the raw message (context,
  structured-data, derived-outputs).
- **Two services match on `error.name` rather than `instanceof`** —
  `document/application/documentService.ts:976` and `persona/application/personaService.ts:466`,
  both swallowing `ResourceHistoryNotFoundError` during a cascade purge. A rename of that class
  would silently break both paths. Prefer `instanceof`; these two sites cross a capability
  boundary where the class identity is the same object, so the string match is unnecessary.
- **Formula is the deliberate exception**: it returns a `FormulaResult` with diagnostics rather
  than throwing, because a user expression error is ordinary data, not an exception.

---

## Logging

- **Never `console.*`.** There is a source-text test enforcing this — but for exactly **two files**
  (`test/capabilities/runtime-wiring.test.ts:202-210` reads `src/index.ts` and
  `src/0-utils/jobs/scheduler.ts` and asserts the regex does not match). Nothing enforces it
  anywhere else. The one deliberate write to a raw stream is
  `1-init/create/logger.ts:44`, `process.stderr.write(...)`, the bounded fallback when the log
  write stream itself errors.
- **Every service takes `logger: Logger` as a dependency.** 48 source files import the interface;
  there are **361 call sites — debug 125, info 157, warn 44, error 35**.
  `registerContextEndpoints(registry, ctx)` is the only capability registration function that
  takes no logger, and it logs nothing. (`registerBuiltInEndpointMappings` also takes none, but
  Built-in has nothing to report.)
- **Log data is a flat object with stable keys.** Include `requestId` / `jobId` for correlation,
  `durationMs` from `performance.now()`, and for errors:
  ```ts
  errorName: error instanceof Error ? error.name : "UnknownError",
  errorMessage: error instanceof Error ? error.message : String(error)
  ```
  Note that the per-wiring `logUnexpected` helpers log **`errorName` only**; transport
  (`registerHttpTransport.ts:18-19`) and the scheduler (`scheduler.ts:32-33`) log both.
- **Level discipline**: `debug` for per-operation timing and statement-level detail, `info` for
  lifecycle and accepted mutations, `warn` for expected-but-notable (capacity, unresolved
  bindings, retries), `error` for the unexpected. `slides/persistence/sqliteSlidesStore.ts:181-184`
  states it plainly: *"The cost is controlled by level. Statement-level detail is `debug`, so it is
  off in production and complete in development. `info` is reserved for durable commits, `warn` for
  outcomes a caller is expected to handle, and `error` for state that should be impossible."*

### `LogOptions.detail` — the shape/content split

Introduced in this commit (`ef6d462`). All four `Logger` methods take a **third parameter**:

```ts
// 0-platform/observability/logger.ts:44-55
export interface Logger {
  debug(message: string, data?: unknown, options?: LogOptions): void;
  info(message: string, data?: unknown, options?: LogOptions): void;
  warn(message: string, data?: unknown, options?: LogOptions): void;
  error(message: string, data?: unknown, options?: LogOptions): void;
  close?(): Promise<void>;
}
```

The label's meaning, from
[`logger.ts:10-27`](../../apps/backend/src/0-platform/observability/logger.ts):

> What kind of thing a record's `data` carries.
>
> - `shape` — counts, enums, IDs, durations. Safe everywhere.
> - `content` — names, titles, prompt text, field values, rows. The fastest way to see what actually
>   happened, and not something a production build should be writing to disk by default.
>
> Labelling the record rather than loosening the rule is the point: the switch from development to
> production becomes one configuration value instead of an audit of every call site, and there is
> still something left to tighten.

Four rules follow, all enforced in `FileLogger.log` (`logger.ts:111-136`):

1. **Unlabelled means `shape`.** `const detail = options?.detail ?? "shape";` with the comment
   *"Unlabelled defaults to `shape`, so every existing call site stays safe without being touched."*
2. **A `content` record is dropped WHOLE, never redacted.** From the constructor doc
   (`logger.ts:80-85`): *"Which detail labels are written. `content` means everything; `shape` drops
   content-labelled records entirely rather than redacting their fields, **because a half-redacted
   record is worse than an absent one — it looks complete**."*
3. **The label is written into the record.** `...(detail === "content" ? { detail } : {})`, with
   *"Written out so a reader can filter after the fact — the label is part of the record, not only
   a decision made at write time."* `LogEntry.detail` is absent on a shape record.
4. **The level filter applies independently.** A `debug`-level content record is dropped by the
   level check first.

The sink's setting is `logging.detail`, default **`"content"`**
(`0-utils/config/loadBackendConfig.ts:180`, comment: *"Developer-friendly by default. Production
flips this one value."*). It is **not present in the shipped `etc/configuration.yaml`**. Parsing
fails open, with the reason in the code (`loadBackendConfig.ts:458-465`): *"Anything that is not
exactly `"shape"` means write everything. An unrecognised value therefore fails open toward more
logging, which is the safe direction while this is a development setting."* See
[09-configuration.md](09-configuration.md).

**There are exactly 9 labelled call sites, all `debug`, all in two capabilities.** The line cited
is the one carrying the `{ detail: "content" }` argument; the call begins a few lines above it.

| Site | What it writes |
| --- | --- |
| `documentService.ts:491` | `document.duplicate.output-declared` — the source prompt text and resolved context entries |
| `documentService.ts:589` | `document.marked-as-template.detail` — the document title |
| `documentService.ts:690` | `document.prompt.rebound` — the variable name, context entries and prompt text a Prompt Block was rebound to |
| `documentService.ts:704` | `document.bindings-applied.detail` — the bindings and the resolved variables |
| `documentService.ts:750` | `document.template-submit.operations` — the whole operation array |
| `templateService.ts:215` | `templates.list.filtered` — the search term and the names it matched |
| `templateService.ts:354` | `templates.register.detail` — template name, description, declared bindings |
| `templateService.ts:465` | `templates.update.detail` — prior and new name, description, bindings, resource operations |
| `templateService.ts:523` | `templates.instantiate.detail` — template name, instance name, instantiation arguments |

**Pair a content record with a shape record.** Every one of the nine sits immediately beside an
unlabelled `info` record carrying the same event's IDs and counts, so dropping content in
production loses the detail and never the structure:

```ts
// templateService.ts:457-470 (abridged)
this.dependencies.logger.debug("templates.update.detail", { …names, …bindings },
  { detail: "content" });
this.dependencies.logger.info("templates.updated", { templateId, kind, resourceId, … });
```

### Two places the mechanism is already defeated

- **`CapturingLogger` — the double 23 test files use — implements the stale two-parameter
  `Logger` and silently discards the label.** `test/helpers/testDoubles.ts:11-29` declares
  `debug(message: string, data?: unknown)` and pushes `{ level, message, data }`; the third
  argument is dropped by erasure. `test/` is outside `tsconfig.json`'s `include`
  (`["src/**/*.ts"]`), so `tsc` never sees the mismatch. The consequence is concrete: **no
  capability test can assert on a detail label**, which is why `logging-detail.test.ts` builds a
  raw `FileLogger` with an in-memory `writeEntry` instead of using the standard double.
- **Slides uses a different, older mechanism that the label was meant to replace.**
  `slides/persistence/sqliteSlidesStore.ts:131-144` reserves a `content` key inside `data`, with
  its own doc comment: *"…so a future `logContent: false` sink can strip `data[CONTENT_KEY]`
  without knowing anything about Slides. **It belongs in `0-platform/observability` once that flag
  lands**; it is here for now because Slides is the only capability observing the convention."* The
  flag landed in this commit and Slides was not migrated. `FileLogger` never inspects `data` and
  Slides passes no `options`, so in `shape` mode every Slides record is still written in full.
  Nothing leaks today only because Slides is unreachable.

Separately, Connector, Context and General Files log values the logger's own taxonomy calls
`content` with no label at all: `general-files.upload` logs `fileName`, `context.declare` logs
`displayName`, and the Connector read events log `itemKey`, which for the filesystem provider is an
absolute path.

---

## Resource deletion and revision history

The shared machinery is
[`0-utils/persistence/resourceHistory.ts`](../../apps/backend/src/0-utils/persistence/resourceHistory.ts)
(244 lines). Ten capabilities use it; **Activity and Knowledge deliberately do not** — Activity is
an append-only ledger and Knowledge is a rebuildable derived index.

- **Typed current tables contain live rows only.** Normal reads must not join history or add a
  deleted-row predicate. There is no `trashed` lifecycle and no `deleted` flag on any current
  table; `deletedAt` appears in the source only as a *parameter name* on store methods.
- **Updating revision *N* archives its complete current snapshot before writing *N+1*.**
- **Logical deletion archives *N*, appends a terminal `deleted` record at *N+1*, and removes the
  current row — in one SQLite transaction.** Public resource models do not expose deletion state.
- **The history DDL is shared and identical everywhere** (`resourceHistory.ts:43-65`): columns
  `resource_kind, resource_id, revision, record_type, snapshot_json, recorded_at`, `PRIMARY KEY
  (resource_kind, resource_id, revision)`, `CHECK (revision >= 1)`, a `record_type IN ('snapshot',
  'deleted')` check, a cross-field check that `snapshot_json` is non-null exactly for snapshots,
  and one `(recorded_at, resource_kind, resource_id)` index. The **table name** stays
  capability-owned.
- **Purge is the only irreversible removal interface.** `purgeResourceHistory` refuses unless the
  latest record is a `deleted` one — a live resource cannot be purged.
- **`pruneHistoryBefore` never removes the terminal tombstone of a still-deleted resource.** That
  single `NOT (record_type = 'deleted' AND revision = MAX(revision))` clause is what makes
  purge-after-prune still work. The optional `isCurrent` callback lets deterministic-ID
  capabilities (Connector, General Files) reclaim a tombstone once the id is live again; all ten
  call sites supply it.
- **The retention cutoff is strict `<`.** A record recorded exactly at the cutoff survives, pinned
  by `test/capabilities/resource-retention.test.ts:25`.
- **Do not add restore or reactivation APIs.** A deterministic ID reappearing before purge is a new
  current row whose revision advances from history (`nextRevisionAfterHistory`).
- **Capability stores own their current schemas and deletion side effects.** Reuse
  `resourceHistory.ts` for history encoding, revision lookup, pruning and purge guards; do not
  re-implement them.

The one place the "capabilities own their own storage" rule gives way is
[`0-utils/persistence/likePattern.ts`](../../apps/backend/src/0-utils/persistence/likePattern.ts),
and the header says why:

> **This lives in `0-utils` rather than in each capability's persistence**, which is the one place
> this codebase's "capabilities own their own storage" rule gives way. The reason is history:
> Templates and General Files each grew a name filter independently, and they disagreed — one
> escaped and one did not, so the same query returned different results depending on which
> capability answered it. Four copies of a four-line function is cheap; four copies that disagree
> is a class of bug nobody goes looking for.

(Its exported `LIKE_ESCAPE_CHARACTER` is dead — every call site hard-codes `ESCAPE '\'`.)

There is **no migration runner and no migration ledger**. Schemas are created fresh with
`CREATE TABLE IF NOT EXISTS`; a schema change means a new table shape and a discarded database
file. This policy appears in no code comment anywhere in `src/` — see
[04-state-and-persistence.md](04-state-and-persistence.md).

---

## Comments

The codebase comments **why**, not what, and the density is highest exactly where it should be:
concurrency, ordering, security and identity decisions. These are the most valuable material in
the repository. Representative examples, verbatim:

```ts
// 0-utils/jobs/scheduler.ts:156-157
// serialActive stays true for the entire job lifecycle, including any
// deferred work that runs after its HTTP response becomes available.

// 1-init/startBackend.ts:210-212
// Start recurring work only after the transport has bound successfully.
// Otherwise a listen failure would leave interval timers keeping the
// failed startup process alive.

// 1-init/startBackend.ts:121-122
// Parent resources precede their owned resources so retention can cascade
// through ownership before a generic child sweep sees the same history.

// 4-job-wiring/context/registerContextEndpoints.ts:46-47
/** Strict on purpose: only a literal boolean true counts. Anything else, including
 *  missing, null, or a truthy-looking string, is treated as "not private". */
```

```ts
/**
 * 1-init/create/resource-reader.ts:45-49
 * Mutable only during composition. Once startup registers the concrete
 * capabilities, callers use this object through the narrow ResourceReader and
 * KnowledgeResourceResolver interfaces.
 */
```

Two further habits worth copying:

- **Explain an omission, not only a choice.** `persona/ports/personaContext.ts:1-16` spends
  sixteen lines on why the port has no `get()`, no `resolve()`, no `list()` and — at length — no
  `update()`.
- **Explain a legal-looking value.** `document/wire/valueSchemas.ts:830-832`:
  ```ts
  // 0 is legal here and means "declared, never answered" — see
  // domain/validation.ts. `prompt.apply-derived-output` still requires a
  // positive revision, because applying revision 0 would be un-answering.
  ```

**Section dividers** `// ─── Name ───` appear in **34 files**, and not only in flat ones — the
archived page's claim that layered files rely on file boundaries instead is wrong. The
distribution: Knowledge 7, Slides 7, Formula 5, Rich Text 5, Derived Outputs 4 of its 5 files,
Persona 2, and one each in `document/application/documentService.ts`, `context/context.ts`,
`4-job-wiring/context/registerContextEndpoints.ts` and `0-platform/database/knowledge-store.ts`.
Structured Data uses none. Use them where a file has genuinely distinct regions; prefer splitting
the file.

---

## Testing

- **`node:test` + `node:assert/strict`.** No test framework dependency. Backend `devDependencies`
  are exactly `@types/better-sqlite3`, `@types/node`, `tsx`, `typescript`.
- **26 `*.test.ts` files (16,054 lines) + 1 helper (52) + 1 smoke script (396).** The suite is
  **444 tests — 325 top-level, 119 subtests, 444 pass, 0 fail, 0 skipped, 0 todo.**
- **One file per capability *layer*, not per capability**, where the capability is big enough:
  `document-domain`, `document-application`, `document-persistence`, `document-wire`;
  `slides-domain`, `slides-persistence`. Wiring gets its own file where an endpoint contract is
  worth pinning: `activity-wiring`, `comments-wiring`, `persona-wiring`, `templates-wiring`.
- **Doubles are hand-written; there is no mocking library.** `test/helpers/testDoubles.ts` provides
  `CapturingLogger`, `ZERO_USAGE` and `TEST_FORMULA_LIMITS` — and nothing else. Everything else is
  built inline in the test file.
- **Test names are full sentences describing the guarantee**, not the mechanism:
  *"Document creation replays identical requests and rejects divergent request reuse"*,
  *"Templates allocates the Template ID rather than accepting one"*,
  *"a capacity-rejected internal intent is redriven in-process"*.
- **Architectural regression tests are legitimate.** Five assertions in the suite read repository
  files as text rather than importing them:

  | Assertion | File | Guards |
  | --- | --- | --- |
  | package `imports` contains 6 named aliases | `runtime-wiring.test.ts:19-30` | a barrel alias being dropped |
  | `dev` script passes `--conditions=…` | `runtime-wiring.test.ts:32-37` | silently running stale `dist/` |
  | no `console.*` in 2 files | `runtime-wiring.test.ts:202-210` | logging that bypasses the sink |
  | `syncScheduler.start()` appears after `await app.listen` | `runtime-wiring.test.ts:212-223` | timers surviving a failed bind |
  | `/connector/list` is registered with an absolute path | `connector.test.ts:51-64` | a relative-path regression |

  **Gap worth stating: `retentionScheduler.start()` is not covered by any ordering assertion.** It
  sits at `startBackend.ts:213`, one line above the covered `syncScheduler.start()`; moving it
  above `app.listen` would fail nothing.
- **The composition-root test is the most valuable test in the tree**, and its comment
  (`runtime-wiring.test.ts:40-55`) says why, including its limit:

  > Every other test in the suite imports concrete modules directly, so a broken composition root is
  > invisible to them: the tree can fail `tsc` and fail to boot while the suite stays green. That is
  > exactly what happened while Slide carried a barrel re-exporting a service file that was never
  > written.
  > …
  > Known limit, verified by deliberately breaking `startBackend` both ways: this catches an
  > unresolvable import whose binding is *used* at runtime, but not one that is unused or type-only
  > — esbuild elides those before Node ever resolves them. `tsc` is what covers that case, which is
  > the argument for running `pnpm typecheck` alongside `pnpm test` rather than treating this as a
  > substitute for it.

- **`--test-concurrency=1` is in the `test` script but is *not* required.** The archived page said
  it was needed because tests share SQLite files under `data/`. That is false: no test opens
  anything under `apps/backend/data/`; 15 test files use `mkdtempSync(os.tmpdir())` and
  `resource-retention.test.ts:26` uses `new Database(":memory:")`. The suite passes 444/444 at
  default concurrency and at `--test-concurrency=16`; the flag costs roughly 3.4× wall clock
  (≈5.1 s versus ≈1.5 s). A defensible replacement rationale is determinism for the tests that use
  real timers and assert on `durationMs`, but that is a different claim and it is unverified.
- **`test/` is not typechecked.** `tsconfig.json`'s `include` is exactly `["src/**/*.ts"]`. Two
  drifts are already present: `CapturingLogger` implements the stale two-parameter `Logger` (above),
  and `templates-wiring.test.ts:23-34` annotates `createTemplatesDouble` as `TemplateCapability`
  while omitting `collectOrphanedResources`. Both compile by erasure and the suite is green.
- **The smoke runner is not part of `pnpm test`.** `test:smoke` is a separate plain-`node` script
  (no tsx, no `node:test`) requiring an already-listening backend. It makes 41 requests, asserts
  exact status codes, and cleans up nothing.

---

## Documentation

When adding a module, add a `docs/` package beside it with the six standard files: `README.md`
(status + implementation map), `concepts.md`, `types.md`, `runtime.md`, `flows.md`,
`invariants.md`. **19 modules have one; 114 `.md` files; Slides is the only module without.**

The convention that makes these valuable is the opening **"Status and authority"** section: state
plainly what is implemented, what is not, and which older design page must *not* be read as
describing current behaviour. **17 of the 19 READMEs carry that exact heading.**
`0-platform/web-retrieval/docs/README.md` is the model — it is a six-page package about a
directory that holds no TypeScript at all, and its first sentence says so.

Most READMEs also carry a table mapping concern → file, which is the fastest way to find the right
file in an unfamiliar module. The heading for it is *not* standardised: 8 use "Source map", 5
"Implementation map", 3 "Dependency and source map", 3 "Current source map". 14 carry a
"Documentation map" listing the other five pages. Pick one of the existing names rather than a new
one.

Two rules learned the hard way, both visible in the current tree:

- **Update the package in the commit that changes the behaviour.** All six Templates doc files were
  last written at `18ab0e8`; the commit that registered a resource runtime, sealed backing copies
  and added the orphan sweep updated none of them, so the package still says *"No resource runtime
  is registered yet."*
- **Do not link into `scratch/`.** Eleven of the twelve capability `docs/` packages do — 13 files
  in all — and `scratch/` holds private drafts that run ahead of the code.

---

## Things the codebase deliberately does not do

Each item re-verified at HEAD.

| Non-goal | Evidence |
| --- | --- |
| **No dependency-injection container, service locator, or decorators.** | Composition is 238 lines of explicit calls in `1-init/startBackend.ts`. |
| **No ORM.** | Hand-written SQL through `better-sqlite3`; 23 files import the driver directly. |
| **No validation library.** | Runtime dependencies are exactly five: `@icarus/shared`, `better-sqlite3`, `dotenv`, `fastify`, `yaml`. No zod, no ajv. Decoders are hand-written. |
| **No mocking library.** | Four devDependencies, none of them a test or mock framework. |
| **No path parameters in routes.** | All 89 registered paths are literal; there is no `:` in any of them, and transport registers a single `app.all("/*")`. IDs travel in the query string or body. |
| **No shared `Database` abstraction.** | Each capability opens its own file and creates its own schema. `0-platform/database/` contains one adapter, for Knowledge. |
| **No migration runner.** | `grep -rn -i "no migration\|not migrate" src` returns nothing, and neither does any migration code. Fresh schemas only. |
| **No premature type sharing.** | `PROSE_TEXT_EXTENSIONS` exists twice on purpose. `general-files/domain/model.ts:5-6`: *"Standalone copy owned by this capability. Not imported from any other capability — lists may intentionally diverge."* `connector/domain/model.ts:2-3` says the same in different words. Both lists are byte-identical today: `txt md markdown rst org tex html htm log`. |
| **No raw `fetch` outside a platform provider boundary.** | `grep -rn "fetch(" src --include=*.ts` returns **one** hit: `0-platform/intelligence/openrouter/provider.ts:256`. |
| **No deep relative imports across modules.** | `grep -rnE 'from "\.\./\.\./\.\.' src` returns **zero**. Cross-module imports use one of the 32 subpath aliases. |
| **No upward imports from `0-platform` / `0-utils`.** | `grep -rn '#init\|#transport\|#capabilities\|#job-wiring' src/0-platform src/0-utils` returns **zero**, and neither directory imports a bare capability alias. |
| **No backward layer imports, with one erased exception.** | `4-job-wiring/structured-data/registerStructuredDataEndpoints.ts:8` does `import type { FormulaNameResolver } from "#init/create/formula-name-resolver.js"` — layer 4 → layer 1. It is `import type`, so it does not exist at runtime; it exists because the *interface* lives in `1-init`. |
| **No `AbortSignal` in the job runtime.** | `JobDefinition` is a union of `work()` and `deferredWork() + work()`. There is no `execute`, no signal, no cancellation. |
| **No restore / undelete API.** | Purge is the only irreversible removal; deletion is terminal until purge, and a reappearing deterministic ID starts a new current row. |
