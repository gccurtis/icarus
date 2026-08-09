# Recent Capabilities Fixes

Date: 2026-08-01

## Purpose

This document explains the implementation changes made after the General Files,
Connector, Structured Data/Formula, and Derived Outputs review. The changes use
the existing capability, repository, Context, Knowledge, and job boundaries.
They do not introduce a second orchestration framework.

## Decisions

### Structured Data is the only named-data capability

Name Manager was removed without migration. Structured Data owns declarations,
stable IDs, names, formula bodies, collections, and the resolver view consumed
by Formula. There is no runtime fallback to a legacy names database.

Formula recognizes language-owned names such as built-ins and lambda-local
parameters itself. Only otherwise-unresolved names are looked up in the frozen
Structured Data resolver snapshot. Previously bound references are checked by
stable binding ID and can never fall through to a new declaration that happens
to reuse the old display name.

The `rate` wording in the original review was only the display name used by a
regression test. “Binding” here means that the Formula syntax tree remembers
the declaration's stable ID; there is no separate “binding rate” feature.

Lambda identities include their lexical captures, including nested functions,
and resolver snapshot identities include binding ID, owner revision, and value
digest. Equal source text therefore does not make two different closures or
declaration owners look identical.

An authored Formula null remains a valid value. Parse failures, evaluation
failures, missing dependencies, and cycles remain diagnostics and are not
inserted into resolver snapshots as null values.

Formula's collection-cell dependency ordering, lazy built-in precedence,
long-chain bound, output cell/byte limits, and non-serializable function
handling are covered by regression tests.

### Runtime imports resolve one implementation

General Files and Connector now have exact and wildcard package-import aliases.
Every backend alias has explicit `development`, `types`, and compiled
`default` conditions; dev and tests select source deliberately instead of
accidentally loading stale `dist` files. Name Manager aliases, factories,
endpoint wiring, source, active design material, and compiled output are gone.

### Validation happens at ingress

Structured Data validates a declaration or newly appended rows when that
payload enters the capability. Existing table contents are not rescanned on
every append or read. This keeps the rule simple while rejecting malformed
schemas, unsupported kinds and values, unsafe numbers, duplicate fields,
invalid row keys, and invalid Formula bodies before persistence.

The one intentional exception is schema replacement: because that operation
changes the meaning of retained rows, it checks those rows once and rejects an
incompatible schema. A “cell” in the review means one field value within a
list, record, or table row; routine reads do not revalidate every cell.

Names use one case-insensitive normalized lookup policy in both SQLite and
Formula, so casing cannot create two declarations that resolve to one key.
Updates and deletes use SQLite revision compare-and-swap, so a stale caller
cannot overwrite or delete a newer declaration.

### Context becomes one frozen scope manifest per refresh

Derived Output definitions continue to accept Context entries. At refresh
start, nested Contexts and concrete resources are composed into one immutable
scope manifest. Every planned retrieval, synthesis retrieval, resource listing,
evidence listing, and direct read uses that same manifest. This provides the
intended “one final Context” semantics without replacing the public Context
model or persisting a second kind of context object.

The runtime resource registry maps General Files and Connector entries to their
Knowledge source IDs and bounded readers. It is created during composition,
then receives the concrete services after those services are constructed. This
small late-registration step breaks the Knowledge/resource construction cycle
without introducing a service locator.

### Derived settlement uses a database compare-and-publish

No new jobs-runtime abstraction was added. A serial → concurrent → serial queue
pipeline would still need a database compare-and-swap to be correct across
concurrent refreshes and process failures. Instead, each refresh freezes the
definition revision, head revision, scope, and project Knowledge generation
once; expensive retrieval and synthesis run concurrently; and one SQLite
transaction publishes only if all frozen versions are still current. A losing
refresh is recorded as discarded and returns `skipped` without changing the
valid head or freshness state.

The no-evidence and synthesized paths use the same settlement operation.
Evidence is accepted only when it matches a trusted retrieval/read candidate,
and positions are labeled as UTF-16 character offsets—the coordinate system
Knowledge actually produces—or as one-based line ranges.

Definition update and deletion are also single SQLite transactions. A
successful Knowledge add/remove conservatively increments one project
generation and marks all Derived Outputs stale. This deliberately broad first
version keeps invalidation correct and small; the generation fence also stops
an in-flight refresh from publishing against content that changed mid-run.

### General File update is wholesale replacement

Updating a General File creates or reactivates the content-addressed replacement
and retires the previous row in one SQLite transaction. Knowledge receives the
new complete content through its existing add/upsert operation. The old source
is removed, and simple compensating operations restore the previous state when
one side fails. This is replacement, not a field-level patch protocol.

Mutation endpoints share the serial queue, while repository replacement still
uses an active-revision compare-and-swap for other processes or direct service
callers. A losing update cannot reactivate the retired Knowledge source or
remove the winner's source.

Extensionless files are valid. UTF-8 byte size is measured as bytes rather than
SQLite character count. Deleted deterministic IDs can be reactivated, allowing
delete followed by re-upload. PDF and DOCX remain non-prose until a real text
extractor exists.

### Connector synchronization owns complete item transitions

The filesystem provider remains deliberately development-only and permissive;
its wire kind remains `filesystem` to avoid needless API churn. It now declares
scheduled-sync support, while the Connector service continues to own snapshot
diffing. Startup discovers persisted schedules, runtime registrations are found
on later ticks, and stale in-process syncing flags are recovered at startup.
The list route is registered at `/connector/list`, and manual refresh is inline
so a successful response means the requested sync actually completed.

Every changed item is replaced from the provider snapshot. Prose additions and
updates call Knowledge add/upsert. Prose-to-other transitions, removed items,
and connector deletion await Knowledge removal. Entry metadata and the current
Knowledge source-ID list are rebuilt from the resulting item set.

Sync and delete write a small `active | pending | failed` ingestion marker
before changing Knowledge. The pending record retains the union of old and new
source IDs. If work fails or the process stops, the connector is visibly
non-active and exposes no uncertain Knowledge sources; the next sync re-adds
all current prose, removes tracked orphans, and only then returns to `active`.
This is the requested reconciliation boundary without a general outbox system.

Reader ranges are bounded and validated, reads honor the actual byte count, and
stream decoding preserves UTF-8 sequences across chunks. PDF and DOCX remain
non-prose until a real text extractor exists.

### Logging uses one correlated path

The shared Logger is passed through HTTP transport, the job scheduler,
capabilities, sync scheduling, and startup. Request IDs flow into jobs, allowing
HTTP and queue records to be joined. Records include operation outcome,
duration, queue wait, status, counts, byte/line sizes, revisions, and structured
error names where applicable. Deferred failures use Logger rather than console.
Provider response bodies and Formula source text are excluded from diagnostics
so logs do not echo prompts or provider responses.

Recurring Connector timers now start only after the HTTP listener binds. This
prevents a failed startup from being kept alive by background intervals.

## Verification

All final checks used the settled tree:

| Check | Result |
|---|---|
| `nix develop --command pnpm test` | **78/78 pass**, 2.24 s backend TAP duration |
| `nix develop --command pnpm typecheck` | Pass across shared, frontend, and backend |
| Clean backend production build | Pass |
| `git diff --check` | Pass |
| Compiled Name Manager search | No files or references under `apps/backend/dist` |
| Isolated production HTTP smoke | **17/17 expected responses** |

The production build was copied unchanged into an isolated temporary runtime,
apart from setting its copied config to unused local port `41273`. Its databases
and JSONL log were written under
`/tmp/icarus-production-smoke.3x9caK/run`; the process was stopped afterward and
the port was confirmed closed. The reusable client is
`apps/backend/test/smoke/http-smoke.mjs` and can be run against a started service
with `pnpm --filter @icarus/backend test:smoke`.

Smoke coverage and client wall times:

| Area | Requests | Result | Client time range |
|---|---:|---|---:|
| Health and missing-route handling | 2 | 200 / expected 404 | 3.73–24.45 ms |
| Structured Data and Formula | 4 | declare/list/evaluate pass; unknown name is a 400 diagnostic, not null | 2.75–6.81 ms |
| General Files | 5 | extensionless upload, wholesale update, get/list/delete pass | 2.08–4.93 ms |
| Connector | 5 | dev filesystem register/read/inline refresh/list/delete pass | 2.19–3.69 ms |
| Derived Outputs transport | 1 | expected missing-output 404 | 2.79 ms |

The smoke log contains 102 JSONL records: 36 info, 64 debug, 2 expected
warnings, and 0 errors. All 16 routed HTTP requests have matching request/job
IDs in both `http.request.completed` and `job.completed`. Rounded server
duration averaged 1.06 ms (0–4 ms); operation records include Formula resolver,
General File, Connector, reader, and sync durations. The Derived pipeline's
model/retrieval paths are covered by ten deterministic tests, including real
SQLite settlement and Knowledge invalidation; the production smoke deliberately
made no paid or external OpenRouter request.

The obsolete local `apps/backend/data/names.db*` files were removed from the
active runtime path without reading or migrating them. A recoverable safety copy
for this session is at `/tmp/icarus-removed-name-manager-2026-08-01/`.

## Deliberate non-goals

- No Name Manager data migration or compatibility endpoint.
- No production authentication/containment policy for the development-only
  filesystem connector.
- No Google Drive, SharePoint, or other remote connector implementation.
- No second job-orchestration framework.
- No fine-grained reverse source-to-output invalidation index yet; project-wide
  stale marking is intentionally conservative.
- No general cross-capability outbox framework. General Files uses synchronous
  compensation, while Connector has the one persisted reconciliation marker it
  needs for partial sync recovery.
- No asynchronous logging backend change without a measured throughput need.
