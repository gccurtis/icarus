# Phase 1 — Frozen Documentation Archive

*Verified against source at commit ef6d462, 2026-08-09.*

> **This directory is a frozen archive.** It preserves the `docs/` tree exactly as it stood
> before the verification pass of 2026-08-09. It is kept for its history and for the design
> intent it records. **It is not a description of the current system and must not be cited as
> one.** Much of it is wrong; that is why the rewrite happened.
>
> Current documentation is **[../phase-2/](../phase-2/README.md)**. Nothing in this directory
> is maintained. Nothing in this directory should be linked from a live page except to say
> "the superseded design page is at `phase-1/…`".

This index (`README.md`) is the one file here written after the freeze. It is not part of the
archived material.

## What is archived

**52 files, 19,463 lines**, covering commits `69444b5` (2026-07-30) through `f7a0757`
(2026-08-02). Reliability verdicts below come from the 2026-08-09 reconciliation, which read
every page against source.

| Path | Files | Lines | Last touched | What it was for | Reliability at HEAD |
| --- | ---: | ---: | --- | --- | --- |
| [`architecture.md`](architecture.md) | 1 | 28 | `d603217` 2026-07-31 | Monorepo layout and doc index | **Substantially accurate.** One broken link (see below); the other seven resolve |
| [`backend-architecture.md`](backend-architecture.md) | 1 | 73 | `69444b5` 2026-07-30 | The original backend design sketch | **Worst file in the tree — eight hard falsehoods.** See below |
| [`capabilities-old/`](capabilities-old/README.md) | 24 | 13,559 | `7926df1` 2026-08-01 | Notion-mirrored specs for 23 target capabilities | **Design intent, not implementation.** 13 of the 23 name capabilities with no directory in the tree. Where a page does overlap code that exists (`document`, `templates`, `comments`, `persona`, `activity`/`presence`, `data`→`structured-data`, `rich-text`, `context`, `slides`) it diverges on types, tables, and routes — often totally |
| [`claude-notes/`](claude-notes/README.md) | 12 | 2,652 | `f7a0757` 2026-08-02 | A code-first snapshot written 2026-08-01 from a full read of the backend | **Mixed, and the best material here.** Four pages need full rewrites (`00`, `01`, `07`, `09`); four are near-accurate (`02`, `03`, `04`, `08`); `05-async-attempt-pipeline.md` was never independently re-verified by the 2026-08-09 pass. Its headline numbers are all stale: `README.md:3-4` says 36,593 lines / 193 files (**47,936 / 236**), `00-orientation.md:41` says 16 test files / 155 tests (**26 / 444**), `09-verified-status.md:27-32` says 231/231 passing (**444/444**) |
| [`notes/notes-1.md`](notes/notes-1.md) | 1 | 43 | `7926df1` 2026-08-01 | A build-group checklist | **Four boxes wrong.** Templates, Investigation, Comments and Persona are all built and wired at HEAD but unchecked. Everything else on the list holds |
| [`platform/`](platform/database.md) | 7 | 1,882 | `bc506b7` 2026-08-02 | Per-platform-service contracts | **The least reliable group.** `database.md` and `web-retrieval.md` are aspirational in full — nothing on either page exists. `knowledge.md` is heavily drifted. `observability.md`'s central rule is now false by default. `formula.md`, `intelligence.md`, `runtime-scope.md` need targeted fixes |
| [`product/`](product/icarus.md) | 2 | 340 | `d603217` 2026-07-31 | Notion-mirrored product model and build groups | **Product intent, explicitly so.** `icarus.md:9` says it defines "the target runtime and persistence contracts". None of the 13 target capabilities it names exists. Its "Runtime Law" section is an accurate description of the implemented job runtime, with one exception noted below |
| [`runtime/`](runtime/dual-queue.md) | 4 | 886 | `e06a8f5` 2026-08-02 | Layer laws, build order, queue semantics, capability map | **The most durable group.** `dual-queue.md`'s ten governing invariants are all true of the code. `repository-boundaries.md`'s placement laws hold; its `JobDefinition` sketch and its `ContextEntry` ownership claim are inverted. `backend-map.md`'s structural half is right and its capability inventory names 15 directories that do not exist |

## The worst offenders, named

**`backend-architecture.md`** describes a flat layer layout — `src/init`, `src/transport`,
`src/job-wiring`, `src/capabilities` (L7-10) — that **never existed in a committed tree**. The
numbered layout (`src/0-platform`, `src/0-utils`, `src/1-init`, `src/2-transport`,
`src/3-capabilities`, `src/4-job-wiring`) landed in `18473dc`, timestamped **seven seconds
after** `69444b5`, the commit that wrote this file. The file was never updated. It also claims
an alias `#config/*` that does not exist, a route `POST /requests/:requestType` (transport
registers exactly one route, `app.all("/*")`, at
[`registerHttpTransport.ts:39`](../../apps/backend/src/2-transport/registerHttpTransport.ts)),
a job `execute` work function (there is none), and file paths under `src/job-wiring/internal/`
and `src/capabilities/internal/` that do not resolve. Its "Queue Execution Model" and
inline/deferred sections are the only parts still true.

*(A stale layout here is not months of neglect: the repository's first commit is `37bbb13`,
2026-07-30, and its last is `ef6d462`, 2026-08-02 — four days and 129 commits of history in
total. The layout was superseded the same minute it was written.)*

**`architecture.md:17`** links to `capabilities/README.md`. That directory was renamed to
`capabilities-old/` in `7926df1` on 2026-08-01 and the link was never fixed — broken for the
entire remainder of the project's committed history. It was reported twice inside this same
archive (`claude-notes/09-verified-status.md:84-85` and
`claude-notes/review/001-consistency-and-doc-drift.md` finding 4) and fixed neither time.

**`platform/database.md`** (93 lines) describes a `Database` runtime object, a migration
runner, `CapabilityMigration`, and a `schema_migrations` table. None exists. `grep -riE
"migrat" apps/backend/src` returns **one hit**, and it is a comment in
[`persona/domain/builtin.ts:5`](../../apps/backend/src/3-capabilities/persona/domain/builtin.ts).
Every capability opens its own `better-sqlite3` connection. For the same reason, the
`icarus.md` Runtime Law bullet "Each capability owns its tables, **migrations**, repository
port…" is accurate on every clause except that one.

## What was carried forward, not merely archived

Four things in here survived verification and were re-stated — re-derived from source, not
copied — in phase-2:

| From | Carried into | What survived |
| --- | --- | --- |
| [`runtime/repository-boundaries.md`](runtime/repository-boundaries.md) | [`../phase-2/01-layers-and-boundaries.md`](../phase-2/01-layers-and-boundaries.md) | The layer placement laws and dependency direction. They hold in code, with a single type-only `4 → 1` exception |
| [`runtime/build-order.md`](runtime/build-order.md), [`notes/notes-1.md`](notes/notes-1.md) | [`../phase-2/12-build-order.md`](../phase-2/12-build-order.md) | The six build groups and their order — Foundations, Resources, Research, Project, Collaboration, Agentic — as a logical sequence distinct from runtime placement |
| [`runtime/dual-queue.md`](runtime/dual-queue.md) | [`../phase-2/02-request-and-job-runtime.md`](../phase-2/02-request-and-job-runtime.md) | The serial/concurrent queue semantics and the ten governing invariants |
| [`product/`](product/definition.md) | [`../phase-2/00-orientation.md`](../phase-2/00-orientation.md) | The product framing: what Icarus is for, and the distinction between target contracts and implemented ones |

One correction to the reconciliation's own inventory: it lists `capabilities-old/slides.md`
among pages whose "named capabilities do not exist".
[`3-capabilities/slides/`](../../apps/backend/src/3-capabilities/slides/) does exist at HEAD —
15 files, 6,765 lines, 87 passing tests — but no request can reach it. It is unreachable, not
absent. See [`../phase-2/07-capabilities/slides.md`](../phase-2/07-capabilities/slides.md).

## Not part of this archive

The **19 per-module documentation packages beside the code**
(`apps/backend/src/**/docs/`, 114 `.md` files, six pages each: `README`, `concepts`, `types`,
`runtime`, `flows`, `invariants`) were never moved here. **They are live and maintained.** They
have their own accuracy problems — `3-capabilities/templates/docs/` and
`0-platform/observability/docs/` are both badly stale as of 2026-08-09 — but they are corrected
in place, not archived. Slides is the only module with no `docs/` package.

**Every link from those live packages into the repository-root `docs/` tree is currently
broken** — 19 markdown links and two bare path mentions, in 17 files, and not one resolves. They
fall into two groups.

**Five links in four packages** point into `docs/capabilities/` — a directory that has not
existed since the 2026-08-01 rename, and whose contents now sit two levels deeper still, at
`docs/phase-1/capabilities-old/`. The five are `0-platform/web-retrieval/docs/README.md:25` and
`:26`, `0-platform/rich-text/docs/README.md:9`, `3-capabilities/document/docs/README.md:69`, and
`3-capabilities/context/docs/README.md:50`. A sixth reference of the same vintage is a code
comment, `0-platform/formula/parser.ts:2`. These were broken long before the freeze.

**Fourteen links in 13 files** point into `docs/platform/` and were broken *by this move* — they
resolved until the root tree was relocated under `phase-1/`, and each now needs one extra
`phase-1/` segment. The affected packages are `database`, `formula`, `intelligence`, `knowledge`,
`observability`, `web-retrieval` (four links across `README`, `concepts` and `types`),
`connector`, `context`, `derived-outputs`, `general-files` and `structured-data`. One prose path
broke the same way: `3-capabilities/persona/docs/README.md:27` cites `docs/capabilities-old/persona.md`.

All of it is a live-doc defect, tracked as KI-74 in
[`../phase-2/11-known-issues.md`](../phase-2/11-known-issues.md), not an archive concern — but
the second group is debt this move created, and whoever fixes `src/**/docs/` inherits it.
