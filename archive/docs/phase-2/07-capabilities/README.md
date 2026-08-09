# 07 · Capability Inventory

*Verified against source at commit ef6d462, 2026-08-09.*

`src/3-capabilities/` holds **13 directories, 133 TypeScript files, 32,246 lines**. Twelve are
reachable over HTTP. `slides/` is built, typechecked and covered by 87 passing tests, and no
request can reach it: nothing constructs it, it has no `application/`, no `index.ts`, no alias, no
factory, no wiring, and `startBackend.ts` never mentions it.

This page is the inventory. One row per capability, every column measured at HEAD. Each row links
to a page that describes that capability in full.

The superseded inventory is at
[phase-1/claude-notes/07-capability-inventory.md](../../phase-1/claude-notes/07-capability-inventory.md).
It lists nine directories, omits Comments, Investigation, Persona, Templates and Slides entirely,
and its Document numbers are wrong in five places. Do not copy from it.

---

## 1 · The master table

Shape vocabulary: **Layered** = `domain/ application/ ports/ persistence/` (+ optional `wire/`,
`projections/`); **Flat** = files at the module root; **Hybrid** = one large service file plus a
store plus a `domain/`; **Functions** = loose exported async functions with no state and no
barrel. Test counts are `# tests` as reported by `node:test`, i.e. top-level tests plus subtests.
Table counts include the capability's slice of the shared revision-history table where it has one.

| Capability | Shape | Endpoints | Exact paths | DB file | Tables | Revision model | Test files (tests) | Src files / lines | Status |
| --- | --- | ---: | --- | --- | ---: | --- | --- | ---: | --- |
| [**document**](document.md) | Layered (+`wire/`, `projections/`) | 2 | `POST /documents/command`, `POST /documents/query` | `data/documents.db` | 13 | Base snapshot + forward ChangeSets; `seq = revision = prior+1`; head CAS; identity ledger; attempts + stages | `document-application` (26), `document-domain` (34), `document-persistence` (7), `document-wire` (9) = **76** | 28 / 9,721 | Complete and by far the best-tested. Two real defects: `logicalDelete` always throws (KI-1); sealed-document refusals return 500 (KI-4) |
| [**investigation**](investigation.md) | Layered (no `wire/`) | **26** | `POST /questions/{create,update,propose-answer,confirm-answer,clear-answer,purge}`, `GET /questions/{get,list}`, `DELETE /questions/delete`; `POST /hypotheses/{create,update,purge}`, `GET /hypotheses/{get,list}`, `DELETE /hypotheses/delete`; `POST /findings/{propose,update,accept,unaccept,reject,mark-reference-review,clear-reference-review,purge}`, `GET /findings/{get,list}`, `DELETE /findings/delete` | `data/investigation.db` | 4 | Typed current tables + shared history; application-layer `revision+1`; logical delete writes snapshot@N + deleted@N+1 | `investigation` (11) | 5 / 2,222 | Complete and wired. **Largest HTTP surface in the backend.** The startup manifest log says `count: 23` — three purge routes are missing from the logged list, a code bug |
| [**structured-data**](structured-data.md) | Flat | 16 | `POST\|GET\|DELETE /structured-data`, `GET /structured-data/{entry,by-name,value/entry,value/by-name}`, `PATCH /structured-data/{rename,description,body,schema}`, `POST /structured-data/{purge,query,rows,evaluate}`, `DELETE /structured-data/rows` | `data/structured-data.db` | 2 | Current + history; CAS on `expectedRevision`; a deleted row leaves a terminal history record | `structured-data-formula` (18) | 6 / 1,089 | Complete. `contextEntries` is write-never (dead feature). WAL only — no other pragma |
| [**connector**](connector.md) | Layered | 10 | `POST /connector/{register,refresh,get,list,read-all,read-range,read-lines,list-items,delete,purge}` | `data/connector.db` | 3 | Deterministic ID (`sha256(provider+locator)`); `nextRevisionAfterHistory`; re-registration resumes at terminal+1 until purge | `connector` (9) | 9 / 1,535 | Complete; filesystem provider only. **`read-*` reads any absolute path on the host (KI-90)**. `ConnectorAlreadyExistsError` is never thrown; `updateSyncTimestamp` is dead |
| [**context**](context.md) | Flat | 10 | `POST\|GET\|DELETE /contexts`, `GET /contexts/{entry,by-name}`, `PATCH /contexts/entries`, `POST /contexts/{purge,resolve,union,difference}` | `data/contexts.db` | 2 | A fresh UUID always starts at revision 1; `update` is a two-stage CAS | `context` (11) | 5 / 569 | Complete. **Four endpoints have no `try/catch`** → generic Fastify 500. Unknown errors default to 400, not 500. No `Logger` is passed to its wiring at all |
| [**derived-outputs**](derived-outputs.md) | Hybrid | 7 | `POST\|GET\|DELETE /derived-outputs`, `GET /derived-output-revisions`, `PATCH /derived-output-definition`, `POST /derived-output-refresh`, `POST /derived-outputs/purge` | `data/derived-outputs.db` | 9 | Mutable definition + immutable numbered revisions; three separate idempotency-claim tables; `_revisions` FK to the stable `_resources` root | `derived-outputs` (17) | 5 / 2,837 | Complete. No HTTP endpoint forwards an idempotency key, so replay safety is in-process only |
| [**general-files**](general-files.md) | Layered | 6 | `POST /general-files/{upload,update,get,list,delete,purge}` | `data/general-files.db` | 2 | Content-addressed id (`sha256(content)`); `nextRevisionAfterHistory`; `replaces_id`/`replaced_by_id` chain | `general-files` (11) | 6 / 871 | Complete |
| [**templates**](templates.md) | Layered (+`wire/`) | 2 | `POST /templates/command`, `POST /templates/query` | `data/templates.db` | 4 | Catalog row + `revision` CAS; command receipts; orphan sweep rides the retention scheduler | `templates` (107), `templates-wiring` (7) = **114** | 14 / 2,436 | Wired; **one** registered kind (`document`). Its own `docs/` package says the opposite. Activity delivery is **startup-drain only** and `break`s on first failure |
| [**comments**](comments.md) | Layered (+`wire/`) | 2 | `POST /comments/command`, `POST /comments/query` | `data/comments.db` | 4 | Current row + history; internal CAS, no client `expectedRevision` | `comments` (7), `comments-wiring` (3) = **10** | 13 / 1,588 | Complete and wired. No optimistic-concurrency field on the wire |
| [**persona**](persona.md) | Layered (+`wire/`) | 2 | `POST /personas/command`, `POST /personas/query` | `data/personas.db` | 2 | Current + history; `expectedRevision` CAS | `persona` (32), `persona-wiring` (11) = **43** | 15 / 1,609 | Wired. **`resolve()` has no production consumer.** Changing a persona's context reference always returns 500 |
| [**activity**](activity.md) | Layered | 2 | `POST /activity/query`, `POST /activity/command` | `data/activity.db` | 3 | **Append-only ledger**; monotonic project sequence from a singleton meta row + canonical digest; Presence is a TTL lease table | `activity` (4), `activity-wiring` (3) = **7** | 8 / 957 | Ledger complete. `POST /activity/command` **always returns 501**. Presence has zero non-test callers and nothing sweeps expired leases |
| [**built-in**](built-in.md) | Functions | 4 | `GET /health`, `GET /health/queues`, `POST /echo`, `POST /audit` | — | 0 | Stateless | none of its own (covered by `internal-jobs`, `runtime-wiring`, smoke) | 4 / 47 | Complete. `POST /audit` is the only deferred job in the tree. Its `docs/` package is 8.9× the size of its code |
| [**slides**](slides.md) | Layered, **incomplete** (`domain/ persistence/ ports/` only) | **0** | — | *(would be `data/slides.db`; never created)* | *(13)* | Base + ChangeSets with exact inverses; SQL `CHECK (seq = revision)` and `CHECK (revision = prior_revision + 1)`; permanent identity ledger | `slides-domain` (61), `slides-persistence` (26) = **87** | 15 / 6,765 | **Built, typechecked, 87 passing tests, and completely unreachable.** No `application/`, no `index.ts`, no `#slides` alias, no `1-init/create/slides.ts`, no `4-job-wiring/slides/`, no `docs/`, and `startBackend.ts` never mentions it |

Cross-cutting test files that belong to no single capability: `internal-jobs` (7),
`runtime-wiring` (8), `resource-retention` (3). Those three plus every row above sum to the
**444** tests in the suite.

### Endpoint counts

```text
built-in 4 · activity 2 · comments 2 · connector 10 · context 10 · derived-outputs 7 ·
document 2 · general-files 6 · investigation 26 · persona 2 · structured-data 16 ·
templates 2 · slides 0
```

**89 registered endpoints** — 58 POST, 18 GET, 7 DELETE, 6 PATCH — from **85**
`registry.register(` call sites. The difference is three `for (const endpoint of [...])` loops in
[`registerInvestigationEndpoints.ts`](../../../apps/backend/src/4-job-wiring/investigation/registerInvestigationEndpoints.ts)
at lines 514, 695 and 730, which register 2, 3 and 2 routes respectively: 85 − 3 + 7 = 89. Any
document that prints 85 as an endpoint count is quoting a call-site count.

---

## 2 · Platform modules are not capabilities

Seven modules live under `src/0-platform/`. They register no endpoints and own no capability page.
They are listed here only so the totals reconcile.

| Platform module | Shape | Endpoints | DB file | Tables | Test files (tests) | Files / lines | Status |
| --- | --- | ---: | --- | ---: | --- | ---: | --- |
| **formula** | Flat (18 files) | 0 | — | 0 | indirect: `rich-text-formula` (4), `structured-data-formula` (18) | 18 / 3,525 | Complete language; `explain()` has no callers; `maxIntegerBits` is never enforced; `.{fields \| cond}` **silently drops the projection** |
| **rich-text** | Flat (12 files) | 0 | — | 0 | (as above) | 12 / 2,218 | Complete value service; several inverses are lossy and `delete-atom`'s throws on replay |
| **knowledge** | Flat + `lattice/`, `windowing/` | 0 | `data/knowledge.db` | 5 | **none** | 15 / 2,118 | Wired and load-bearing, **with no test file**. The level-index feature is entirely dead; `StreamWindower` is unreachable |
| **intelligence** | Flat (5 files, no barrel) | 0 | — | 0 | **none** (one negative test on the provider) | 5 / 914 | `infer`, `inferStructured`, `reason` and `reasonWithTools` have **no production caller**; 9 of the 18 configured routes are unreachable |
| **observability** | Flat (1 file) | 0 | — | 0 | `observability` (3), `logging-detail` (5) = 8 | 1 / 137 | Complete. Filtering and entry-building only; the sink lives in `1-init/create/logger.ts` |
| **database** | Flat (1 file) | 0 | (`data/knowledge.db`) | (5) | **none** | 1 / 389 | **Not a database platform.** One SQLite adapter for Knowledge. No shared `Database`, no migration runner, no pool |
| **web-retrieval** | — | 0 | — | 0 | none | **0 / 0** | **Scaffold only.** A `.gitkeep` and six doc pages. Zero TypeScript |

Full treatment is on [06-platform-services.md](../06-platform-services.md).

---

## 3 · How to read a capability page

Every page in this directory carries the same nine sections in the same order, so two capabilities
can be compared by scrolling to the same heading.

| § | Section | What it contains |
| --- | --- | --- |
| — | H1 + verification line | The commit and date every fact on the page was checked against |
| — | Opening paragraph | What the capability is **for**, in one paragraph, with no roadmap language |
| 1 | **At a glance** | Shape, endpoint count, DB file, table count, revision model, test files and counts, source files and lines, status |
| 2 | **Domain model** | The canonical types with their real field lists. Discriminated unions are enumerated in full — every arm, no "and others" |
| 3 | **Operations / commands / queries** | Every one, by exact name, with the exact wire fields where a decoder enumerates them |
| 4 | **Endpoints** | Exact `METHOD path`, job name, queue type, response mode, and what the route does |
| 5 | **Persistence** | Every table with its purpose and key columns, then the revision model spelled out |
| 6 | **Invariants** | What is actually enforced, and the `file:line` that enforces it |
| 7 | **Design decisions worth preserving** | Verbatim quotations of the code comments that explain *why*. These are the most valuable prose in the repository and are reproduced without paraphrase |
| 8 | **Known gaps and defects** | Everything dead, unreachable or broken. Items with an ID in [11-known-issues.md](../11-known-issues.md) link to it |

Reading conventions used throughout:

- **`file:line` is load-bearing.** Any claim that could be wrong carries the line that proves it.
  Line numbers are valid at `ef6d462` and nowhere else.
- **"Unreachable" means unreachable, and the page says from where.** A method with no production
  caller is named as such rather than described as available.
- **Source paths are relative links.** From a capability page, the backend is at
  `../../../apps/backend/src/…`.
- **The module's own `docs/` package is a separate artefact.** Nineteen of the twenty modules
  under `0-platform` and `3-capabilities` carry a six-file `docs/` package (`README`, `concepts`,
  `types`, `runtime`, `flows`, `invariants`) — 114 markdown files in total. Slides is the only
  module with none. Where a module package contradicts the code, the capability page says so and
  names the file and line.

---

## 4 · The thirteen pages

| Page | Endpoints | Why you would open it |
| --- | ---: | --- |
| [document.md](document.md) | 2 | The reference implementation: the `wire/` decoder pattern, Base + ChangeSet revisions, the identity ledger, the attempt/stage pipeline, Context Variables and template mode |
| [templates.md](templates.md) | 2 | The inverted cross-capability seam, structural port satisfaction with no adapter, receipts instead of claims, and the orphan sweep that rides retention |
| [investigation.md](investigation.md) | 26 | The largest HTTP surface; three record families behind one runtime; the only Knowledge-write path outside Connector and General Files |
| [comments.md](comments.md) | 2 | Flat annotations against an opaque, never-re-evaluated anchor; the cleanest small worked example of the house shape |
| [persona.md](persona.md) | 2 | Structural satisfaction of `PersonaContextPort` by `ContextManager`, and the defect that seam hides |
| [connector.md](connector.md) | 10 | Deterministic IDs, external-source reads, the four-timer sync scheduler |
| [general-files.md](general-files.md) | 6 | Content-addressed identity and the `replaces_id` chain |
| [context.md](context.md) | 10 | Named and private context records, set composition, and the four endpoints with no error handling |
| [structured-data.md](structured-data.md) | 16 | The Formula evaluation surface and the widest REST-shaped route table |
| [derived-outputs.md](derived-outputs.md) | 7 | Prompt execution, idempotency claims, and the Intelligence coupling |
| [activity.md](activity.md) | 2 | The append-only ledger, the canonical digest chain, and the 501 command endpoint |
| [slides.md](slides.md) | 0 | 6,765 lines and 87 passing tests that no request can reach |
| [built-in.md](built-in.md) | 4 | Health, queue state, echo, and the only deferred job in the tree |

---

## 5 · What every capability shares

Four contracts hold across capability boundaries. None of them is enforced by a type; all of them
are convention that happens to be applied consistently.

| Contract | Detail |
| --- | --- |
| Retention errors → HTTP | `ResourceNotDeletedError` → **409 `not_deleted`** and `ResourceHistoryNotFoundError` → **404 `not_found`**, mapped identically in all ten wiring files that handle them. This is the only cross-capability HTTP contract in the tree |
| The shared history DDL | [`0-utils/persistence/resourceHistory.ts:43-65`](../../../apps/backend/src/0-utils/persistence/resourceHistory.ts) supplies the columns, the CHECKs, the primary key, the `_recorded` index and the two error classes. Each capability owns the table *name*, the `resource_kind` value, and the decision of *when* to archive |
| The retention sweep | Eleven ports in a fixed order, `purgeExpired` then `pruneHistory` per port, each in its own `try/catch`, one cutoff per sweep. Activity and Knowledge are deliberately absent |
| Table-name scoping | Every table is prefixed with a per-capability literal plus `sha256(config.projectId).hex.slice(0,16)` — `activity_`, `cmt_`, `conn_`, `ctx_`, `do_`, `doc_`, `gf_`, `inv_`, `kn_`, `psn_`, `sd_`, `tpl_`. The original project id is never persisted, so a database file cannot say which project owns a prefix |

The mechanics are on [04-state-and-persistence.md](../04-state-and-persistence.md); the request
path is on [02-request-and-job-runtime.md](../02-request-and-job-runtime.md).
