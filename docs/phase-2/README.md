# Icarus Backend Documentation — Phase 2

*Verified against source at commit ef6d462, 2026-08-09.*

## What this is

This directory describes the Icarus backend **as it exists at commit `ef6d462` on `main`**, measured
on 2026-08-09. It is a description, not a design target and not a plan. Every number on every page
was produced by running a command against this checkout; every load-bearing claim carries a
`file:line`. Where the code is incomplete, dead, unreachable or broken, the pages say so in those
words and name the file.

Two rules govern the whole set:

1. **Nothing here is aspirational.** There is no "should", no "will", no roadmap language — with one
   deliberate exception, [12-build-order.md](12-build-order.md), which is explicitly about what is
   not built yet and in what order it would have to be.
2. **A defect is documented, not smoothed.** [11-known-issues.md](11-known-issues.md) exists so that
   the capability pages never have to pretend. When a capability page describes a path that always
   throws, it says "always throws" and points at the line.

The set is a snapshot. It will drift the moment the code moves. It carries its commit and its date
at the top of every page so that a reader can tell how far.

## What this backend is

The Icarus backend is a single Fastify process (`apps/backend`) that registers **exactly one HTTP
route** — `app.all("/*")`, at
[`2-transport/registerHttpTransport.ts:39`](../../apps/backend/src/2-transport/registerHttpTransport.ts)
— and turns every request into a job. An endpoint registry maps the exact string
`"<METHOD> <path>"` to a job factory; a two-queue scheduler (one serial queue, one concurrent worker
pool) runs the job; the result is written back on the same request. **89 endpoints** are registered
this way across **13 capability directories**, 12 of which are reachable over HTTP. Capabilities own
their own storage — each opens its own `better-sqlite3` connection, and the running system holds
**12 SQLite files with 53 live tables**. There is no dependency-injection container, no ORM, no
migration runner, no validation library, no mocking library and no CI: composition is 238 lines of
hand-written calls in
[`1-init/startBackend.ts`](../../apps/backend/src/1-init/startBackend.ts), and the backend has five
runtime dependencies (`@icarus/shared`, `better-sqlite3`, `dotenv`, `fastify`, `yaml`).

## Reading order

Read top to bottom on a first pass. The pages are ordered so that each one only assumes what came
before it.

| # | Page | What it covers |
| --- | --- | --- |
| — | **README.md** (this page) | What this set is, how to read it, where the other three tiers of documentation live |
| 00 | [00-orientation.md](00-orientation.md) | Repo map, backend layout, source volume by layer, the toolchain, the Nix dev shell, the `--conditions=development` resolution mechanism and the stale-`dist/` hazard |
| 01 | [01-layers-and-boundaries.md](01-layers-and-boundaries.md) | The six numbered source directories, the 32-entry alias map, which imports are permitted, and the one import that points the wrong way |
| 02 | [02-request-and-job-runtime.md](02-request-and-job-runtime.md) | The single wildcard route, the endpoint registry, the serial and concurrent queues, inline vs deferred jobs, and the three status codes transport chooses |
| 03 | [03-capability-anatomy.md](03-capability-anatomy.md) | The layered / flat / hybrid capability shapes, what each internal layer may know, and where the shapes disagree with each other |
| 04 | [04-state-and-persistence.md](04-state-and-persistence.md) | The 12 SQLite files and 53 live tables, project-hashed table prefixes, the shared revision-history DDL, and the 11-port retention sweep |
| 05 | [05-async-attempt-pipeline.md](05-async-attempt-pipeline.md) | Document's attempt and stage model — how work that outlives a request is admitted, staged and settled |
| 06 | [06-platform-services.md](06-platform-services.md) | The seven `0-platform` modules — Formula, Rich Text, Knowledge, Intelligence, Observability, Database, Web Retrieval — and how much of each has a production caller |
| 07 | [07-capabilities/README.md](07-capabilities/README.md) | Index of the 13 capability pages: endpoints, shape, database file, test count, status, side by side |
| — | `07-capabilities/*.md` | One page per capability directory — [document](07-capabilities/document.md), [templates](07-capabilities/templates.md), [investigation](07-capabilities/investigation.md), [comments](07-capabilities/comments.md), [persona](07-capabilities/persona.md), [connector](07-capabilities/connector.md), [general-files](07-capabilities/general-files.md), [context](07-capabilities/context.md), [structured-data](07-capabilities/structured-data.md), [derived-outputs](07-capabilities/derived-outputs.md), [activity](07-capabilities/activity.md), [slides](07-capabilities/slides.md), [built-in](07-capabilities/built-in.md) |
| 08 | [08-conventions.md](08-conventions.md) | Naming, one-file-per-layer, the error vocabulary shared across capabilities, and the testing conventions (including the ones enforced by source-scanning tests) |
| 09 | [09-configuration.md](09-configuration.md) | `etc/configuration.yaml`, the loader's parsing rules and its sharp edges, the single environment variable, and the `logging.detail` content switch |
| 10 | [10-verified-status.md](10-verified-status.md) | What was measured on 2026-08-09 and the exact commands to re-measure it: typecheck, 444 tests, a real boot, the live endpoint list |
| 11 | [11-known-issues.md](11-known-issues.md) | 96 entries — defects, unreachable code and dead exports, each with a `file:line` and a statement of what a caller actually observes. **The most severe is KI-90:** `POST /connector/read-*` returns the contents of any absolute path on the host |
| 12 | [12-build-order.md](12-build-order.md) | The one page about future work: what is not built, and the order the existing dependencies impose |

## If you only read three pages

| Read | Because |
| --- | --- |
| [00-orientation.md](00-orientation.md) | It is the only page that tells you how to run the thing, and it names the two ways to silently run the wrong code (stale `dist/`, missing `--conditions=development`) |
| [02-request-and-job-runtime.md](02-request-and-job-runtime.md) | Every one of the 89 endpoints goes through the same 125-line transport, the same registry and the same scheduler. Understand that once and the capability pages become lookup tables |
| [10-verified-status.md](10-verified-status.md) | It is the difference between "documented" and "true". It carries the measurements, the commands that produce them, and the list of things no test covers |

If you are about to change code rather than read it, add
[11-known-issues.md](11-known-issues.md) — several of the defects it lists sit in seams that the
tests deliberately double, so a green suite is not evidence that the path works.

## Headline measurements

Every page in this set agrees with this table. It was measured on 2026-08-09 at `ef6d462`; the
commands are in [10-verified-status.md](10-verified-status.md).

| Measure | Value |
| --- | ---: |
| Backend TypeScript | **236 files / 47,936 lines** |
| Test files | 26 `*.test.ts` (16,054 lines) + 1 helper + 1 smoke script |
| Tests | **444 total — 444 pass, 0 fail, 0 skipped** |
| Typecheck (`tsc --noEmit`) | **exit 0, no output** |
| Registered HTTP endpoints | **89** (58 POST, 18 GET, 7 DELETE, 6 PATCH) from 85 `registry.register` call sites |
| Capability directories | **13** — 12 reachable over HTTP, `slides` built but unreachable |
| SQLite files / live tables | **12 / 53** |
| Internal (non-HTTP) job intents | **7**, all Document |
| Deferred endpoints | **1** (`POST /audit`) |
| Retention ports | **11** |
| Module `docs/` packages | **19** (114 `.md` files) |

Note the two counts that are easy to conflate: **85 is the number of `registry.register(...)` call
sites; 89 is the number of registered endpoints.** Three of the call sites are `for` loops inside
Investigation's wiring, which between them register seven endpoints
([`4-job-wiring/investigation/registerInvestigationEndpoints.ts`](../../apps/backend/src/4-job-wiring/investigation/registerInvestigationEndpoints.ts),
lines 514, 695 and 730). Any document that prints 85 as an endpoint count is wrong.

## The four documentation tiers in this repository

| Tier | Location | Size | What it is | How far to trust it |
| --- | --- | --- | --- | --- |
| 1 | `docs/phase-2/` — here | 27 pages | Cross-cutting description of the backend as a whole | Verified at `ef6d462`, 2026-08-09 |
| 2 | `apps/backend/src/**/docs/` | 19 packages, 114 files, 12,982 lines | Per-module documentation living beside the code it describes | Mixed — see below |
| 3 | [`docs/phase-1/`](../phase-1/) | 52 files, 19,463 lines | The previous documentation tree, archived wholesale | **Superseded. Much of it is false** |
| 4 | `scratch/` | — | The owner's private design drafts, deliberately ahead of the code and carrying uncommitted edits | Not documentation. Not read for this set, and never cited by it |

### Tier 2 — the per-module packages

Nineteen modules under `0-platform/` and `3-capabilities/` carry their own `docs/` directory, and
every one of them has exactly the same six files: `README.md`, `concepts.md`, `types.md`,
`runtime.md`, `flows.md`, `invariants.md`. 19 × 6 = 114, which is the whole markdown population
under `apps/backend/src`.

**`3-capabilities/slides/` is the only module without one** — see
[07-capabilities/slides.md](07-capabilities/slides.md).

These packages go deeper than this set does: an `invariants.md` will list a capability's real
concurrency guarantees and its real gaps. Their quality is uneven and the unevenness matters:

| Verdict | Count | Modules |
| --- | ---: | --- |
| Accurate as written | 10 | formula, knowledge, intelligence, database, web-retrieval, built-in, connector, derived-outputs, general-files, structured-data |
| Accurate with specific stale points | 6 | activity, comments, context, document, investigation, persona |
| Materially stale | 3 | rich-text (its entire Slide section), observability, templates |

The two best are `3-capabilities/structured-data/docs/` — which self-reports its own racy conflict
precheck, its unpopulated `contextEntries` table and its hard-coded limits — and
`0-platform/web-retrieval/docs/`, whose `runtime.md` is an inventory of zeros for a module that
contains no TypeScript at all. The two worst are `0-platform/observability/docs/`, written before
the logging sink was rewritten and before the `detail` label existed, and
`3-capabilities/templates/docs/`, whose README still says no resource runtime is registered when
[`startBackend.ts:119`](../../apps/backend/src/1-init/startBackend.ts) registers Document.

**This set does not correct them.** Where a module package contradicts a page here, the page here is
the one that was verified on 2026-08-09.

### Tier 4 — `scratch/`

`scratch/` holds design drafts that run ahead of the code and are edited continuously. Nothing in
this documentation set was read from it, nothing here is derived from it, and no page links into it.
Several *module* `docs/README.md` files do link into `scratch/` — those links point at private,
uncommitted material and should not be followed as specification.

## What `docs/phase-1/` is, and why it was archived rather than updated

[`docs/phase-1/`](../phase-1/) is the entire previous `docs/` tree, moved unchanged: 52 files and
19,463 lines in six groups — 2 root pages, `capabilities-old/` (24 files, 13,559 lines),
`claude-notes/` (12), `platform/` (7), `runtime/` (4), `product/` (2) and `notes/` (1).

It was archived, not patched, for three reasons.

**1. It describes a smaller tree than the one that exists.** `phase-1/claude-notes/README.md:3-4`
opens with "36,593 lines of source across 193 TypeScript files, plus 9,115 lines across 16 test
files and one helper". The measurement today is **47,936 lines across 236 files**, and **16,054
lines across 26 test files** — 11,343 more source lines, 43 more source files, 10 more test files.
Almost every count on almost every page is therefore wrong, and wrong in the same direction.
`phase-1/claude-notes/09-verified-status.md:31` still prints `# tests 231   # pass 231`; the suite
reports 444.

**2. Several pages are not stale but structurally wrong.** A sample, each checked against source:

| Archive page | The claim | The code |
| --- | --- | --- |
| `phase-1/backend-architecture.md:7-10` | The layers are `src/init`, `src/transport`, `src/job-wiring`, `src/capabilities` | They are `src/1-init`, `src/2-transport`, `src/4-job-wiring`, `src/3-capabilities` — and the page never mentions `src/0-platform` or `src/0-utils`, which together are 61 files |
| `phase-1/claude-notes/07-capability-inventory.md:3` | "Nine directories under `3-capabilities`" | Thirteen. Comments, Investigation, Persona, Templates and Slides are absent from the page entirely — including Investigation, which owns 26 of the 89 endpoints |
| `phase-1/platform/observability.md:143` | "**Never logged.** User content, prompts, provider bodies, Formula source, persona section text, comment bodies" | `logging.detail` defaults to `"content"`, and nine call sites in Document and Templates deliberately log prompt text, template names, search terms and resolved context entries. See [09-configuration.md](09-configuration.md) |
| `phase-1/claude-notes/00-orientation.md:41` | "`capabilities/*.test.ts   16 files, 155 tests`" | 26 files, 444 tests |
| `phase-1/runtime/repository-boundaries.md:139-144` | `JobDefinition` has an `id` and an `execute(signal?: AbortSignal)` method | [`0-utils/jobs/types.ts:34`](../../apps/backend/src/0-utils/jobs/types.ts) declares `JobDefinition` as a union of `work()` and `deferredWork() + work()`. There is no `execute` on it, no `AbortSignal` in the job runtime at all, and `id` belongs to `Job` (`types.ts:35`), not to the definition |

**3. Patching would have destroyed the reader's ability to tell what had been checked.** A page with
five corrected sentences and forty unchecked ones reads exactly like a page that is correct. Moving
the tree wholesale and rewriting against source makes the boundary explicit: everything under
`docs/phase-2/` was verified on one day at one commit, and everything under `docs/phase-1/` was not.

Some of the archive is good work and was used as *input* — `phase-1/claude-notes/` set the tone for
this set, its request-and-job-runtime page survived line-by-line re-verification almost intact, and
its self-warning at `phase-1/claude-notes/README.md:53-61` ("These notes are a snapshot taken
2026-08-01 and have since drifted") is honest and was correct in kind, if not in scale. None of that
makes any individual sentence in it safe to cite.

`phase-1/capabilities-old/` deserves a separate warning: at 24 files and 13,559 lines it is 70% of
the archive, and it describes a product design that was never built — capabilities named
Spreadsheet, Analysis, Evidence, Research, Project, Workspace, Questions, Agents, Automation,
Sources, Media, Library Kernel and Import/Export, none of which exist as a directory. Its pages for
capabilities that *do* exist (Document, Comments, Persona, Templates, Activity) describe schemas and
routes that are not the ones in the code. Use it as intent, never as reference.

## Conventions used on these pages

- Every page opens with an H1 and the italic verification line naming the commit and the date.
- Source references are `file:line` against `apps/backend/src/…` unless another root is given, and
  are relative links where the target is a file this set can point at.
- Code comments are quoted verbatim when they explain a decision. They are the most valuable prose
  in the repository and are reproduced rather than paraphrased.
- "Unreachable" means unreachable, and the page says from where. "Dead" means no caller exists in
  `src/`. "Untested" means no test file exercises it, and the pages distinguish that from "tested
  only through a double".
