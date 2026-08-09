# Recent Capabilities Implementation Review

Date: 2026-07-31
Reviewed HEAD: `8428b9d` (`feat: implement General Files and Connector capabilities`)
Also reviewed: `977d4ff` (Derived Outputs), `cfc097c` (Structured Data / Formula resolution), their scratch designs, current runtime wiring, SQLite stores, logging, and historical logs.

> **Follow-up completed 2026-08-01.** This file preserves the original review
> evidence. The implemented repairs, final 78/78 test result, production smoke,
> and current design decisions are recorded in
> [Recent Capabilities Fixes](recent-capabilities-fixes-2026-08-01.md).

## Executive verdict

The latest capabilities are not ready to rely on as an integrated production path.

There are three useful positive results:

1. The live Formula resolver is constructed with one explicit Structured Data instance, and a regression test proves that no unrelated store participates in resolution.
2. Basic General Files content addressing/idempotency works for ASCII content with a nonempty extension.
3. The Derived Outputs no-evidence path can publish an `insufficient` revision and emits timing logs.

The principal blockers are:

- a fresh production build cannot start because the `#general-files` and `#connector` runtime import aliases are missing;
- Connector permits arbitrary server-side file reads through an unvalidated `itemKey`;
- Formula can silently retarget an already-bound reference to a different stable ID;
- Derived Outputs loses Context scope in tool retrieval, cannot read General Files or Connector resources, and corrupts freshness during concurrent refreshes;
- ordinary General Files update fails its foreign-key constraint after already soft-deleting the original;
- scheduled Connector sync is not wired and can never be enabled for the filesystem provider.

No production implementation was changed during this review. The repository changes are test infrastructure, focused characterization/regression tests, and this report.

## What was added

The repository convention explicitly provides `apps/backend/test/` outside the numbered runtime layers (`docs/runtime/repository-boundaries.md:20-48`), so tests were placed there rather than adding a new numbered `src` layer.

- `apps/backend/test/capabilities/connector.test.ts`
- `apps/backend/test/capabilities/derived-outputs.test.ts`
- `apps/backend/test/capabilities/general-files.test.ts`
- `apps/backend/test/capabilities/runtime-wiring.test.ts`
- `apps/backend/test/capabilities/structured-data-formula.test.ts`
- `apps/backend/test/helpers/testDoubles.ts`
- root and backend `test` scripts

Each persistence harness uses its own temporary SQLite file. This exercises the actual table definitions, WAL behavior, and repository adapters without touching the normal `./data` databases. The stores also accept SQLite `:memory:` for faster unit tests; temporary files remain useful for persistence/restart tests once stores expose `close()`.

Run the suite with:

```bash
nix develop --command pnpm test
```

The tests express intended contracts, not the current broken behavior, so the suite is intentionally red until the findings are fixed.

## Verification results

| Check | Result |
|---|---|
| Backend/full workspace typecheck | Pass |
| Backend build | Pass |
| Fresh production start (`node dist/index.js`) | **Fail**: `ERR_PACKAGE_IMPORT_NOT_DEFINED` for `#general-files` |
| Focused test suite | **20 total: 3 pass, 17 fail** |
| Connector tests | **0/5 pass** |
| Derived Outputs tests | **1/4 pass** |
| General Files tests | **1/4 pass** |
| Runtime wiring tests | **0/2 pass** |
| Structured Data / Formula tests | **1/5 pass** |

Passing tests:

- Formula resolution uses only the Structured Data instance composed into the resolver.
- General Files ASCII upload is content-addressed/idempotent, logs upload, and omits content from list results.
- Derived Outputs publishes and logs a no-evidence `insufficient` revision.

The 17 failures map one-to-one to confirmed defects; none are failures to initialize a test harness.

## Isolated live smoke results

The service was run with an explicit TypeScript config from `/tmp/icarus-capability-smoke.Kp3E8S`. This kept all six SQLite databases and the JSONL log out of the repository. The process was stopped after the requests and port 4000 was released.

Fastify timings are server response times, not client wall time:

| Request | HTTP | Server time | Result |
|---|---:|---:|---|
| `GET /health` | 200 | 0.657 ms | Healthy |
| Unknown route / route inventory | 404 | 0.441 ms | Returned complete registered endpoint list |
| `GET /structured-data` | 200 | 0.479 ms | Empty isolated store |
| `POST /structured-data` | 201 | 2.553 ms | Declared `smokeRate = 40 + 2` |
| `POST /structured-data/evaluate` | 200 | 6.675 ms | `smokeRate * 2` returned exact rational `84/1` |
| `POST /general-files/list` | 200 | 6.671 ms | Empty isolated store |
| `POST /general-files/upload` | 200 | 1.668 ms | Non-prose `.bin` stored |
| `POST /general-files/get` | 200 | 2.779 ms | Content returned |
| `POST /connector/register` | 200 | 2.874 ms | Filesystem item registered, but requested `5min` sync was discarded (`syncConfig: null`) |
| `POST /connector/read-all` | 200 | 3.089 ms | File content returned |
| `POST /connector/refresh` | 202 | 1.194 ms | Deferred acknowledgement; sync completed later |
| `POST /connector/get` | 200 | 1.676 ms | Revision advanced to 2 after manual refresh |
| `POST /connector/list` | **404** | 0.505 ms | Endpoint is incorrectly registered as `POST connector/list` |
| `GET /derived-outputs?id=missing` | 404 | 3.149 ms | Expected not-found response |
| `POST /derived-outputs` | 201 | 3,619.730 ms | Published `insufficient`, zero-evidence revision |

The isolated custom JSONL file contains 31 records. Useful operation statistics from it:

- Formula resolver snapshot build: 2 ms, one binding, one pass.
- Structured Data evaluation: 5 ms, three evaluator steps.
- Derived planning: 1,830 ms, 368 tokens, reported cost `$0.001144`.
- Seven sequential retrieval-query embeddings: 1,776 ms total, 56 tokens, reported cost about `$0.00000112`.
- Derived refresh total: 3,617 ms; synthesis was skipped because retrieval returned no regions.
- Connector sync had 1 item, 0 added, 0 changed, and 0 removed, but its log contains no `durationMs`.
- General Files upload and Connector registration logs also contain no duration.

The existing repository log does not validate finalized commits:

- all four recorded Derived Outputs declarations occurred before commit `977d4ff` was finalized; three failed and one completed (`insufficient`, zero evidence, 2,959 ms);
- both recorded General Files uploads occurred before commit `8428b9d` was finalized;
- there is no recorded Connector execution in that log.

## Structured Data + Formula verdict

### What is true now

Formula currently pulls only from Structured Data in the live composition root:

- `apps/backend/src/1-init/startBackend.ts:32-37` creates Formula, Structured Data, and `createFormulaNameResolver(formula, structuredData, ...)`.
- `apps/backend/src/1-init/create/formula-name-resolver.ts:55-58` calls `projectStructuredData.bindingView()`.
- startup constructs and registers only the Structured Data authority for project names.

This is the desired source-authority direction. Formula should not gain a second name-store fallback.

### Remaining boundary work

The obsolete parallel name-store implementation has now been removed without a data migration, by explicit decision. Broader Data consolidation remains incomplete:

- Structured Data is only project-scoped in runtime, while the scratch design also promises user scope;
- the newer canonical Data design (`docs/capabilities/data.md`) describes one Data facade with separate internal declaration and value aggregates, which is not the current single `DataEntry` union.

Recommended consolidation:

1. Confirm the canonical model: preferably one public Data facade, with an internal declaration catalog and structured-value aggregate so identity/name revisions are not coupled to unrelated value metadata revisions.
2. Reconcile project/user scope and namespace semantics while Formula continues to read Structured Data only.
3. Keep the removed parallel store from reappearing through aliases, factories, endpoints, or resolver fallbacks.

## Findings and potential solutions

### F-01 — Blocker: built runtime cannot load the newest capabilities

`apps/backend/tsconfig.json:27-30` defines `#general-files` and `#connector`, but `apps/backend/package.json` has no matching runtime `imports` entries. A fresh build succeeds because TypeScript knows the paths, then `pnpm start` fails while loading General Files job wiring.

The development command is also unsafe: `tsx watch src/index.ts` does not select the `types`/source condition, so existing aliases normally resolve through `dist`. Before a build this can silently execute stale code; after a fresh build it becomes a hybrid of compiled and source modules.

Potential solution:

- add both exact and wildcard runtime import mappings for General Files and Connector;
- give every alias an explicit development/source condition and run dev with that condition;
- add a CI test that builds, boots `node dist/index.js`, checks `/health`, and asserts the exact route inventory.

### F-02 — Critical security: Connector can read arbitrary server files

`registerConnectorEndpointMappings.ts:98-106` accepts caller-supplied `itemKey`; `connectorService.ts:390-403` forwards it without checking membership; `providers/filesystem.ts:116-118` ignores the registered locator. A caller with any valid connector ID can request another readable path.

The test registers one temporary directory and successfully obtains a reader for a secret file outside it, causing the expected containment assertion to fail.

Potential solution:

- authorize Connector endpoints and configure allowed filesystem roots;
- expose opaque item IDs rather than absolute paths;
- check requested items against the persisted connector item index;
- resolve symlinks with `realpath` and enforce containment under the registered real locator;
- add traversal, sibling-path, symlink, and time-of-check/time-of-use tests.

### F-03 — Critical correctness: stable Formula bindings silently retarget

`FormulaEngine.evaluate` binds again (`0-platform/formula/engine.ts:224-235`). The binder looks up the current display name and ignores a binding already present on the AST (`0-platform/formula/binder.ts:27-47`). After binding `rate` to ID A, renaming A, and declaring a new ID B as `rate`, the old expression evaluates successfully against B rather than returning `stale_binding`.

Potential solution:

- when a node already has a bound reference, resolve by `bindingId` first;
- compare owner revision/value digest according to an explicit stale policy;
- never fall back from a stale stable ID to the current display-name owner;
- cover rename, delete, rename-and-redeclare, and same-value/new-ID cases.

### F-04 — Critical correctness: resolver failures become successful `null`

The resolver treats all symbolic names as Structured Data dependencies. Dependency extraction includes Formula built-ins and lambda-local parameters, so `SUM([1, 2])` and `LAMBDA(x, x + 1)` remain unresolved. Parse failures, evaluation failures, cycles, unknown names, and pass-limit leftovers are all inserted as ordinary `NULL_VALUE` bindings (`formula-name-resolver.ts:103-157`). Value endpoints then return HTTP 200.

Potential solution:

- build a lexical-aware dependency graph that excludes built-ins and lambda locals;
- topologically evaluate declarations and use strongly connected components for cycle diagnostics;
- carry typed per-binding failures in the snapshot result or omit failed bindings;
- have endpoints return diagnostics/non-2xx rather than a successful null;
- remove the hardcoded 32-pass limit in favor of configured graph bounds.

### F-05 — High: recent resource capabilities are not integrated with Derived Outputs or scoped Knowledge

`createResourceReader()` is a null-only stub (`1-init/create/resource-reader.ts:1-20`) and receives neither General Files nor Connector. A test uploads an actual General File and proves the runtime reader still returns no content.

Knowledge scoping also keeps only `kind === "document"` and compares raw context IDs to Knowledge source IDs (`0-platform/knowledge/knowledge.ts:229-235`). General Files use `general-file:<id>` and Connector uses one hashed source ID per prose item, so neither maps correctly.

Potential solution:

- create a resource registry after General Files and Connector are constructed;
- map `(resourceKind, resourceId)` to a bounded reader and to zero/one/many Knowledge source IDs;
- inject that registry into Derived Outputs and Knowledge scope resolution;
- test Context containing General Files, single-file connectors, and directory connector items end to end.

### F-06 — High: Derived Outputs can escape Context scope

Initial planned retrieval supplies `contextEntries` (`derived-outputs.ts:508-513`), but the synthesis `retrieve` tool calls `knowledge.retrieve(query)` with no scope (`:775-801`). The test records `{ scope: [...] }` for the first call and `undefined` for the follow-up tool call.

Potential solution:

- resolve/freeze a scope manifest at refresh start;
- close every retrieval tool over that immutable manifest;
- reject rather than broaden if scope resolution fails;
- include the scope digest in attempts, logs, and evidence provenance.

### F-07 — High: Derived refresh settlement is not concurrency-safe

The design requires serial freeze, concurrent compute, and serial settlement. The implementation registers one concurrent inline job for the whole refresh (`registerDerivedOutputEndpoints.ts:133-150`). It checks definition revision on the synthesis path but not whether `headRevision` changed, and the no-evidence path bypasses settlement checks entirely.

Two concurrent no-evidence refreshes both target revision 1; one succeeds, the other gets a uniqueness error and marks the valid output `failed`. This is reproduced in the test suite.

Potential solution:

- implement explicit freeze, compute, and settle jobs;
- add one transactional `publishRevisionIfCurrent(outputId, expectedDefinitionRevision, expectedHeadRevision, candidate, attempt)` repository operation;
- return `skipped: true` for the losing refresh;
- run the same settlement path for no-evidence and synthesized candidates;
- test concurrent definition updates/deletes and restart recovery.

### F-08 — High: General Files update fails after partially mutating state

`generalFileService.ts:196-201` soft-deletes the old row, writes `replacedById` before the referenced new row exists, and only then inserts the new row. Foreign keys are enabled, so the middle update fails. The original soft-delete has already committed.

Potential solution:

- move replacement into one repository transaction;
- insert the new row first, update the old link second, and roll back both on error;
- coordinate Knowledge changes through a pending/outbox state or compensating operation;
- assert the original remains readable after any failed update.

### F-09 — High: documented valid files violate SQLite constraints

General Files and Connector both represent no extension as `""`, while their SQL schemas require `length(extension) > 0`. General Files calculates UTF-8 byte length with `Buffer.byteLength`, while SQL compares it to SQLite character count via `length(content)`. Tests reproduce extensionless failures in both capabilities and a multibyte General File failure.

Potential solution:

- permit null/empty extensions consistently;
- store raw bytes as BLOBs or use a byte-correct invariant;
- define whether non-text `content` is decoded bytes or a base64 transport value, and hash/size the decoded bytes;
- do not classify binary PDF/DOCX containers as directly indexable prose without extraction.

### F-10 — High: scheduled filesystem synchronization is nonfunctional

The filesystem provider does not implement `syncType`; requested intervals are therefore discarded. `ConnectorSyncScheduler.start()` only iterates its private empty map, never calls the implemented `store.listSyncableEntries()`, and is never notified on registration/deletion.

Potential solution:

- make the filesystem provider satisfy the chosen scheduled-sync contract;
- discover persisted scheduled entries at startup;
- register/unregister entries after mutations or query due entries each tick;
- recover stale `syncing` flags after crashes;
- use monotonic due times and log enqueue rejection/duration.

### F-11 — High: Connector sync transition leaves stale Knowledge and metadata

On prose-to-other change, the sync branch starts from the old `knowledgeSourceId`, never removes/clears it, and spreads the old item without updating name, extension, or byte size (`connectorService.ts:254-280`). The test confirms `knowledge.remove` is never called.

Potential solution:

- implement an explicit transition matrix for prose→prose, prose→other, other→prose, removal, addition, and unchanged;
- update every item field from the provider snapshot;
- transact metadata and use reconciled/compensating Knowledge operations.

### F-12 — High: Structured Data and Formula lookup invariants disagree

SQLite display-name uniqueness is case-sensitive, while Formula lowercases lookup keys. `Revenue` and `revenue` can coexist and one silently overwrites the other in a resolver map. `/value/entry` can consequently return one entry's metadata with another entry's value.

Collection formula cells are also evaluated eagerly before variables/functions and failures silently become null. A valid table cell referring to a same-snapshot variable reproduces this.

Potential solution:

- persist a canonical normalized name under a unique index and define Unicode normalization/case-fold policy;
- fail snapshot construction on collisions and verify binding ID in `/value/entry`;
- include collection cells in the dependency graph or represent them lazily;
- return row/field path diagnostics for cell failures.

### F-13 — High: Structured Data validation and exact-value seams are incomplete

Record row count, list width, duplicate fields, row keys, `FieldDef.kind`, schema/value conformance, and context entries are not validated. Record resolution discards rows after the first; list resolution uses only the first cell. `date` is declared as a Data value kind although Formula has no date value. JS numbers can lose exactness before rational conversion, and functions serialize/hash as null.

Potential solution:

- centralize ingress/schema validation;
- use Formula wire values or decimal strings for exact numbers;
- reject unsupported/nonserializable values with typed diagnostics;
- expose create/update APIs for Context entries;
- enforce Formula `maxCells` and `maxOutputBytes`, which are currently configured but not applied.

### F-14 — High: Derived evidence, validation, and freshness are not trustworthy

- Knowledge positions are JavaScript string indices, but Derived Outputs labels them byte offsets, breaking non-ASCII provenance.
- Tool handlers automatically persist every inspected region as evidence, even though the model is supposed to select only evidence used.
- Runtime validation accepts invalid status values, malformed spans, fractional ranks, and empty successful content.
- no source-change path marks dependent outputs stale.
- the strict evidence schema has mutually inconsistent required span fields/minima.

Potential solution:

- issue opaque evidence handles from trusted retrieval/read operations;
- let the model select handles and supply contribution/rank only;
- resolve canonical identities/spans in service code;
- use one well-defined offset unit and test multibyte text;
- validate the structured result fully;
- maintain a reverse source-to-output index and consume Knowledge change events/outbox records.

### F-15 — High: persistence and Knowledge updates are not failure-atomic

General Files persists before Knowledge admission; a failed embed leaves a row that future idempotent upload reuses without retrying admission. Connector admits Knowledge items before inserting metadata. Sync changes Knowledge before repository settlement. Deletes fire-and-forget removal and return success first. Soft-deleted content/locator-derived primary keys cannot be re-uploaded/re-registered without a primary-key conflict.

Potential solution:

- define explicit pending/active/failed ingestion state and reconciliation;
- use transactional outbox/saga patterns across SQLite and Knowledge;
- await tracked deletion or return a durable job/status ID;
- define resurrection semantics or separate stable identities from version/history rows.

### F-16 — Medium/high: logging is injected but not operationally sufficient

The shared Logger is passed through Formula, Structured Data, Derived Outputs, General Files, Connector, and scheduler construction. This is a good base. Coverage and shape are inconsistent:

- General Files and Connector operation logs generally omit `durationMs`;
- Connector reads/get/list/delete errors are largely unlogged;
- scheduler enqueue failures are swallowed, and deferred scheduler failures use `console.error`;
- custom JSONL logs and Fastify request logs are separate and share no request/job/attempt correlation;
- Derived failure logs persist raw provider response bodies; historical logs contain provider metadata and a user identifier, contrary to redaction guidance;
- failure attempts record zero usage even after work was performed;
- startup logs General Files readiness but not Connector/Derived readiness;
- synchronous `appendFileSync` on every log entry may become a throughput bottleneck.

Potential solution:

- add a common job/operation telemetry wrapper with `requestId`, `jobId`, `attemptId`, operation, status, error code, duration, item/byte counts, queue wait, and usage/cost;
- route Fastify and capability logs through one correlation context;
- redact locators, paths, prompts, provider bodies, API metadata, and user identifiers;
- emit stage-level and consolidated Derived usage;
- buffer JSONL writes or use a structured async sink after measuring load.

## Recommended repair order

1. Fix runtime aliases/dev resolution and add a production boot/route test.
2. Close Connector arbitrary-file-read access before exposing the endpoint.
3. Fix Formula stable-binding semantics and replace resolver-null failures with diagnostics.
4. Add the resource/source registry and preserve Context scope through all Derived tools.
5. Implement transactional Derived settlement and explicit serial→concurrent→serial jobs.
6. Fix General Files replacement transaction and cross-store reconciliation.
7. Repair SQLite extension/byte constraints and deterministic-ID resurrection policy.
8. Wire scheduled Connector discovery and implement the sync transition matrix.
9. Reconcile Structured Data with the canonical Data facade and scope model.
10. Complete validation, provenance, freshness propagation, performance bounds, and correlated/redacted logging.

## Commands used

```bash
nix develop --command pnpm typecheck
nix develop --command pnpm test
nix develop --command pnpm --filter @icarus/backend build
nix develop --command pnpm --filter @icarus/backend start
```

Production startup currently fails after the successful build. The isolated live smoke used the backend `tsx` binary with `--tsconfig apps/backend/tsconfig.json` solely to exercise the current source while keeping databases/logs under `/tmp`.
