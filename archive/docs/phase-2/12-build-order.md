# Build order

*Verified against source at commit ef6d462, 2026-08-09.*

This is the only page in `docs/phase-2/` that is allowed to talk about work that has not been
done. Everything it says about what *has* been done is measured; everything it says about what
remains is expressed as a list of artifacts that are absent from the tree, not as a plan.

---

## 1. Scope: this page describes local `main` at `ef6d462` and nothing else

Six local branches exist in this checkout, plus the remote `origin/main`. **Five of the six local
branches are not ancestors of `HEAD`, and neither is `origin/main`**, so the work on them is
invisible to every measurement on this page and on
[10-verified-status.md](10-verified-status.md).

| Ref | Tip | Ancestor of `HEAD`? | Ancestor of `origin/main`? | Subject at tip |
| --- | --- | :-: | :-: | --- |
| `main` (local, checked out) | `ef6d462` | — | yes | feat(observability): label log records by detail, and log content |
| `origin/main` | `c5fa6d7` | **no** | — | feat(slides): Phase 5 — prompt text sources |
| `slides-phase2` | `c5fa6d7` | **no** | yes | same commit as `origin/main` |
| `agents-capability` | `0e147d1` | **no** | **no** | feat(agents): stages 3 and 4 — redirect a running agent, and let it change something |
| `backup-slides-work` | `7a50e68` | **no** | **no** | feat(slides): log authored content under a reserved `content` key |
| `structured-analytic-phase1` | `68e88b9` | **no** | **no** | fix(structured-data): an empty context means the whole project, plus 46 tests |
| `worktree-phase-c-context-and-gc` | `d4dcd1e` | **no** | yes | docs: correct two claims that the code contradicts |

**Local `main` is 16 commits behind `origin/main`.** Four of those 16 are further Slides phases:

```text
acfdd81  feat(slides): Phase 3 — wire layer
4a76c78  refactor(slides): adopt the platform detail label for content logging
3279cf5  feat(slides): Phase 4 — service, composition, and a working slice
c5fa6d7  feat(slides): Phase 5 — prompt text sources
```

On `origin/main` and on `slides-phase2`, `src/3-capabilities/slides/` has `application/` and
`wire/` subdirectories. **At `ef6d462` it has neither.** An `agents/` capability directory
(41 files) exists on `agents-capability` and on **no** other ref, including `origin/main`.

Nothing below describes those commits. A future writer who wants to describe Slides or Agents
from a branch tip must say which commit and which date, explicitly — otherwise the page will
claim a capability exists that the checked-out tree cannot build.

---

## 2. Status vocabulary

Three states, used consistently below. "Reachable" always means *reachable over HTTP by a
client*, which requires all of: a capability directory, a construction site in
[`1-init/create/`](../../apps/backend/src/1-init/create/), a line in
[`startBackend.ts`](../../apps/backend/src/1-init/startBackend.ts), and a
`register…Endpoints` call at `startBackend.ts:176-186`.

| Status | Meaning |
| --- | --- |
| **Built · reachable** | Source exists, is typechecked, and at least one HTTP endpoint is registered |
| **Built · unreachable** | Source exists and is typechecked; no request can reach it |
| **Absent** | No directory, no port, no test, no reference anywhere in `src/` |

Platform modules (`0-platform/*`) register no endpoints by design; for those, "reachable" means
some capability injects them at `startBackend.ts`.

---

## 3. Correcting the archived tracker

The checklist archived at `phase-1/notes/notes-1.md` (43 lines) has **four boxes that are
straightforwardly wrong** at `ef6d462`, plus two that are technically right and misleading. The
superseded build-order narrative is at `phase-1/runtime/build-order.md`; its §5/§6 prerequisites
name a "Project capability" and a "Library Kernel", **neither of which exists in the tree**.

| Archived box | Reality at `ef6d462` | Proof |
| --- | --- | --- |
| `[ ] Templates` | **Built and reachable.** 14 files / 2,436 lines, 2 endpoints, `templates.db` (4 tables), 114 tests | `startBackend.ts:120, 186` |
| `[ ] Investigation` | **Built and reachable, and it owns the largest HTTP surface in the backend** — 26 endpoints, 10 more than the next capability. 5 files / 2,222 lines, `investigation.db` (4 tables), 11 tests | `startBackend.ts:71, 184`; `investigation.test.ts:646` asserts `listEndpoints().length === 26` |
| `[ ] Comments` | **Built and reachable.** 13 files / 1,588 lines, 2 endpoints, `comments.db` (4 tables), 10 tests | `startBackend.ts:55, 182` |
| `[ ] Persona` | **Built and reachable.** 15 files / 1,609 lines, 2 endpoints, `personas.db` (2 tables), 43 tests | `startBackend.ts:64, 183` |
| `[ ] Slides` | Right that it is not runnable; **wrong by omission.** 15 files / 6,765 lines and 87 passing tests exist, and none of it is reachable | [§5](#5-resources) |
| `[X] Activity (Presence)` | Right about Activity, **wrong about Presence.** Presence writes are unreachable | [§7](#7-project) |

Four other things are built that the archived tracker never lists at all: **Derived Outputs**,
the **built-in** endpoints, **Observability**, and the **Database** platform module. They are in
[§9](#9-modules-the-archived-tracker-never-listed).

---

## 4. Foundations — all five built

| Item | Status | Endpoints | Source | DB · tables | Tests |
| --- | --- | --: | --- | --- | --- |
| Intelligence | Built · injected | 0 | `0-platform/intelligence` — 5 files / 914 lines | — | **0 direct** |
| Context | Built · reachable | 10 | `3-capabilities/context` — 5 files / 569 lines | `contexts.db` · 2 | 11 |
| Formula | Built · injected | 0 | `0-platform/formula` — 18 files / 3,525 lines | — | **0 direct** |
| Structured Data (*"Data"* on the tracker) | Built · reachable | 16 | `3-capabilities/structured-data` — 6 files / 1,089 lines | `structured-data.db` · 2 | 18 |
| Rich Text | Built · injected | 0 | `0-platform/rich-text` — 12 files / 2,218 lines | — | 4 indirect |

Caveats that matter for anything built on top of these:

- **Intelligence.** Only `embed` (via Knowledge), `reasonStructured`
  ([`derived-outputs.ts:817`](../../apps/backend/src/3-capabilities/derived-outputs/derived-outputs.ts))
  and `reasonWithToolsStructured` (`derived-outputs.ts:939`) have production callers. `infer`,
  `inferStructured`, `reason` and `reasonWithTools` have **zero**, so 9 of the 18 configured
  routes are unreachable. There is no Intelligence test file; the one direct assertion anywhere
  is the negative provider-redaction test at `runtime-wiring.test.ts:173`.
- **Context.** Four of its ten endpoints have no `try/catch` in their wiring, so a domain error
  from those routes reaches Fastify's generic 500 handler. No `Logger` is passed to
  `registerContextEndpoints` at all (`startBackend.ts:177` — two arguments, not three).
- **Formula.** The language is complete except for one silent-wrong-answer path: the projection
  pipe discards its projection
  ([`parser.ts:335-347`](../../apps/backend/src/0-platform/formula/parser.ts)). There is no
  `formula.test.ts`; the 22 tests that touch Formula import only `engine`, `resolver`, `wire` and
  the barrel. `maxIntegerBits` is declared and never enforced.
- **Rich Text.** Operation application is not uniformly idempotent: `applyDeleteAtom` throws a
  raw `Error("Atom not found: …")` when the atom is already gone
  ([`operations.ts:318-319`](../../apps/backend/src/0-platform/rich-text/operations.ts)), so
  replaying a `delete-atom` — the inverse an `insert-atom` produces at `operations.ts:300` —
  fails rather than no-ops. Rich Text has no test file of its own; the four tests that touch it
  exercise Formula-atom authoring and settlement. See
  [06-platform-services.md](06-platform-services.md).

---

## 5. Resources

| Item | Status | Endpoints | Source | DB · tables | Tests |
| --- | --- | --: | --- | --- | --- |
| Knowledge | Built · injected | 0 | `0-platform/knowledge` — 15 files / 2,118 lines | `knowledge.db` · 5 | **0** |
| Document | Built · reachable | 2 | `3-capabilities/document` — 28 files / 9,721 lines | `documents.db` · 13 | 76 |
| **Slides** | **Built · unreachable** | **0** | `3-capabilities/slides` — 15 files / 6,765 lines | *never created* | **87** |
| Spreadsheet | **Absent** | — | — | — | — |
| Connector | Built · reachable | 10 | `3-capabilities/connector` — 9 files / 1,535 lines | `connector.db` · 3 | 9 |
| General Files | Built · reachable | 6 | `3-capabilities/general-files` — 6 files / 871 lines | `general-files.db` · 2 | 11 |
| Templates | Built · reachable | 2 | `3-capabilities/templates` — 14 files / 2,436 lines | `templates.db` · 4 | 114 |

`3-capabilities/document` is 9,721 lines; counting the four files under `4-job-wiring/document/`
(224 lines) and `1-init/create/document.ts` (75 lines), everything Document owns is 33 files /
10,020 lines.

### 5.1 Slides is the single largest gap on this page

Slides is inside the `tsc` project, so it typechecks on every build, and it carries 87 passing
tests — **one fifth of the entire suite** — and there is no way to reach any of it. `grep -in
slide src/1-init/startBackend.ts` returns nothing. The only reference to Slides anywhere outside
its own directory and its two test files is a *comment* at
[`templatableResource.ts:32-33`](../../apps/backend/src/3-capabilities/templates/ports/templatableResource.ts)
using `slides::deck` / `slides::slide` as an example of a compound kind.

Present at `ef6d462`: `domain/` (11 files), `persistence/` (3), `ports/` (1).

Absent, each one independently verifiable:

| Missing artifact | Check that shows it missing |
| --- | --- |
| `slides/application/` service | `ls src/3-capabilities/slides` → `domain persistence ports` |
| `slides/index.ts` barrel | same |
| `#slides` / `#slides/*` aliases | `grep '"#slides' apps/backend/package.json apps/backend/tsconfig.json` → no match |
| `1-init/create/slides.ts` | `1-init/create/` holds 23 files; none is `slides.ts` |
| `4-job-wiring/slides/` | `ls src/4-job-wiring` → 11 capability groups, `internal/`, a root `registerBuiltInEndpointMappings.ts`, and two empty untracked directories (`formula/`, `name-manager/`). No `slides` group |
| Any line in `startBackend.ts` | `grep -in slide src/1-init/startBackend.ts` → no match |
| A `docs/` package | Slides is the **only** one of the 20 module directories without one — 19 packages, 114 markdown files |
| `slides.db` | `SQLiteSlidesStore` is never constructed, so no such file is ever created |

Because `dist/` was last built on 2026-08-02, `dist/3-capabilities/` contains no `slides` either.

What Slides *does* carry at `ef6d462` is a fully declared contract for the service that does not
exist, all of it verified by counting the union arms in
[`domain/model.ts`](../../apps/backend/src/3-capabilities/slides/domain/model.ts):
**9 commands** (`SlideCommand`, L771), **8 command results** (L832), **4 queries** (L847),
**4 query results** (L853), **7 internal job intents** (`SlideInternalJobIntent`, L864),
**54 operations** (`SlideOperation`), **14 error classes** (`domain/errors.ts`, 7 of which
nothing throws), **40 store-port methods** (`ports/slidesStore.ts`), and a schema of
**12 tables plus the shared revision-history table**
(`persistence/sqliteSchema.ts` — 12 `CREATE TABLE` statements and one
`initializeResourceHistorySchema` call at `:309`). Those are type declarations, not behaviour.

Note the naming: the directory, the port and the store are plural (`slides/`, `SlidesStore`,
`SQLiteSlidesStore`), while every domain type is singular (`SlideCommand`, `SlideOperation`,
`SlideInternalJobIntent`). Archived pages that say `Slide*` are describing a **different,
deleted** capability tree; see [07-capabilities/slides.md](07-capabilities/slides.md).

### 5.2 Knowledge is load-bearing and has no test file

Knowledge is injected into Investigation (narrowed to `Pick<Knowledge,"add"|"remove">`), General
Files, Connector and Derived Outputs, and it is the sole subscriber-source for
`onSourceMutation` → Derived Outputs (`startBackend.ts:95-97`). There is no
`knowledge*.test.ts`. It is exercised only as a side effect of four capabilities' own tests. Its
level-index feature is entirely dead — three port methods, one table, zero callers, and the table
is never even written.

### 5.3 Templates has exactly one registered kind

`templateResources.register(document)` at `startBackend.ts:119` is the only registration, and the
comment above it explains why the seam is shaped that way:

```text
// One line, no adapter: DocumentCapability satisfies TemplatableResource
// structurally. This is the only place that sees both, which is what keeps
// Templates and Document from importing each other.
```

Any other kind answers `400 unsupported_kind`. That seam currently harbours a defect that the
tests cannot see because they double the port — see [11-known-issues.md](11-known-issues.md).

### 5.4 Spreadsheet

Absent. No `src/3-capabilities/spreadsheet/`, no port, no test, no reference. The archived
capability design at `phase-1/capabilities-old/spreadsheet.md` describes a system that was never
built.

---

## 6. Research

| Item | Status | Endpoints | Source | DB · tables | Tests |
| --- | --- | --: | --- | --- | --- |
| Analysis | **Absent** | — | — | — | — |
| Investigation (Findings, Questions, Hypotheses) | Built · reachable | **26** | `3-capabilities/investigation` — 5 files / 2,222 lines | `investigation.db` · 4 | 11 |
| Research | **Absent** | — | — | — | — |

**Investigation is built and is the largest HTTP surface in the backend**, at 26 endpoints across
three record families behind one runtime, one store port, one connection and four tables. It has
one live code bug worth knowing before reading its startup log:
[`registerInvestigationEndpoints.ts:818-819`](../../apps/backend/src/4-job-wiring/investigation/registerInvestigationEndpoints.ts)
logs `investigation.endpoints.registered { count: 23, … }`. The registry holds 26. The three
omitted from the manifest are `POST /questions/purge`, `POST /hypotheses/purge` and
`POST /findings/purge`. The running service under-reports itself by three routes.

**Research is blocked on a platform module that contains no code.**
`src/0-platform/web-retrieval/` holds a `.gitkeep` and a six-page `docs/` package — **0
TypeScript files, 0 importers**. There is no `1-init/create/webRetrieval.ts`, no
`interface WebRetrieval`, and no `research/` or `sources/` directory under `3-capabilities/`.
That module's own docs state the position plainly, and the sentence is worth preserving verbatim
([`web-retrieval/docs/README.md:30`](../../apps/backend/src/0-platform/web-retrieval/docs/README.md)):

> No production code can currently search or fetch through this platform boundary. Any capability
> requiring web retrieval must first implement and compose it; using raw `fetch` elsewhere would
> bypass the intended security and normalization boundary.

Research cannot be built against a boundary that has no types. Analysis is absent for a simpler
reason: nothing of it exists anywhere in the tree.

---

## 7. Project

| Item | Status | Endpoints | Source | DB · tables | Tests |
| --- | --- | --: | --- | --- | --- |
| Activity — ledger | Built · reachable | 2 | `3-capabilities/activity` — 8 files / 957 lines | `activity.db` · 3 | 7 |
| Activity — **Presence** | **Built · writes unreachable** | 0 of its own | (same directory) | (same file) | (same 7) |
| Comments | Built · reachable | 2 | `3-capabilities/comments` — 13 files / 1,588 lines | `comments.db` · 4 | 10 |
| Workspace | **Absent** | — | — | — | — |

The Activity ledger is complete: append-only, with a monotonic project sequence from a singleton
meta row and a canonical digest. Document, Comments and Templates all publish into it.

**Presence is a different story, and the box on the archived tracker hides it.** Presence is a
sub-object of the Activity runtime (`ActivityPresenceRuntime` with `heartbeat`, `leave`, `list`,
`removeExpired`, `activityService.ts:40-45`) backed by a TTL lease table. Of those four:

| Method | Reachable over HTTP? | Why |
| --- | --- | --- |
| `list` | **Yes** — `POST /activity/query` with `{"type":"presence.list"}` | decoded at `registerActivityEndpoints.ts:91-93` |
| `heartbeat` | **No** | the only write door is `POST /activity/command`, which returns 501 before decoding anything |
| `leave` | **No** | same |
| `removeExpired` | **No** | zero production callers; the only calls are `activity.test.ts:146` and a double at `activity-wiring.test.ts:61` |

The wiring says why, and the message is the clearest statement of the blocker anywhere in the
repository —
[`registerActivityEndpoints.ts:158-165`](../../apps/backend/src/4-job-wiring/activity/registerActivityEndpoints.ts):

```ts
      return {
        statusCode: 501,
        body: {
          error: "presence_transport_unsupported",
          message:
            "Presence commands require a trusted session-aware transport; HTTP does not provide one yet."
        }
      };
```

The consequence, stated plainly: **the presence lease table is never written to in production, so
`presence.list` always returns an empty array, and nothing sweeps leases that could never be
created.** Presence needs a transport that carries a trusted session identity; the current
transport registers exactly one route, `app.all("/*")`, and has no session concept.

Workspace is absent — no directory, no port, no test.

---

## 8. Agentic

| Item | Status | Endpoints | Source | DB · tables | Tests |
| --- | --- | --: | --- | --- | --- |
| Persona | Built · reachable | 2 | `3-capabilities/persona` — 15 files / 1,609 lines | `personas.db` · 2 | 43 |
| Agents | **Absent from `main`** | — | — | — | — |
| Automation | **Absent** | — | — | — | — |

Persona is wired at `startBackend.ts:64` and `:183`. Its only dependency is Context, which it
consumes through `PersonaContextPort` (`declare`, `delete`, `purge` — note there is **no**
`update`), satisfied structurally by `ContextManager` with no adapter. Two caveats:

- `resolve()` has **no production consumer**.
- Changing a persona's context reference returns **HTTP 500** today, because the replacement
  wrapper is declared while the old one of the same name is still live and
  `ContextConflictError` is not on the endpoint's error ladder. Both Persona test suites
  substitute a `PersonaContextPort` double whose `declare` never checks names, which is exactly
  why nothing catches it. Detail in [11-known-issues.md](11-known-issues.md).

**Agents is absent from `main`.** An `agents/` capability directory with 41 files exists on the
`agents-capability` branch at `0e147d1`, which is not an ancestor of `HEAD` **or** of
`origin/main`. Nothing about it is measured on this page. Automation is absent everywhere.

---

## 9. Modules the archived tracker never listed

| Module | Status | Endpoints | Source | DB · tables | Tests |
| --- | --- | --: | --- | --- | --- |
| Derived Outputs | Built · reachable | 7 | `3-capabilities/derived-outputs` — 5 files / 2,837 lines | `derived-outputs.db` · 9 | 17 |
| Built-in | Built · reachable | 4 | `3-capabilities/built-in` — 4 files / 47 lines | — | **0 direct** |
| Observability (platform) | Built · injected | 0 | `0-platform/observability` — 1 file / 137 lines | — | 8 |
| Database (platform) | Built · injected | 0 | `0-platform/database` — 1 file / 389 lines | (`knowledge.db`) | **0** |
| Web Retrieval (platform) | **Scaffold** | 0 | **0 files / 0 lines** | — | — |

Two of these need qualifying:

- **`0-platform/database` is not a database platform.** It is one SQLite adapter for Knowledge.
  There is no shared `Database` object, no migration runner, no ledger and no pool; every
  capability opens its own `better-sqlite3` connection, and 23 source files import the driver
  directly. The module's own docs say so at
  [`database/docs/README.md:7`](../../apps/backend/src/0-platform/database/docs/README.md), and
  the sentence should be preserved verbatim: *"The older Database platform design describes an
  intended broader boundary; it must not be read as implemented behavior."*
- **Built-in owns the only deferred job in the tree** (`POST /audit`). It has no `node:test`
  coverage at all; `/health` is touched only by the smoke script, and `/health/queues`, `/echo`
  and `/audit` by nothing.

---

## 10. The whole picture, one table

| Build group | Built (reachable over HTTP, or injected) | Built · unreachable | Absent |
| --- | --- | --- | --- |
| Foundations | Intelligence, Context, Formula, Structured Data, Rich Text | — | — |
| Resources | Knowledge, Document, Connector, General Files, Templates | **Slides** | **Spreadsheet** |
| Research | Investigation | — | **Analysis**, **Research** |
| Project | Activity (ledger), Comments | Activity → **Presence** writes | **Workspace** |
| Agentic | Persona | — | **Agents** (on a branch), **Automation** |
| *Not on the tracker* | Derived Outputs, Built-in, Observability, Database | — | Web Retrieval (scaffold) |

Totals that follow from the rows above, and which every page in `docs/phase-2/` agrees on:

| Measure | Value |
| --- | --- |
| Capability directories | **13** (12 reachable over HTTP; Slides is built and unreachable) |
| Registered HTTP endpoints | **89** — 58 POST, 18 GET, 7 DELETE, 6 PATCH, from 85 `registry.register` call sites (3 of which are loops) |
| Per capability | built-in 4 · activity 2 · comments 2 · connector 10 · context 10 · derived-outputs 7 · document 2 · general-files 6 · investigation 26 · persona 2 · structured-data 16 · templates 2 · **slides 0** |
| SQLite files | **12** (a 13th, `slides.db`, is never created) |
| Live tables | **53** |
| Internal, non-HTTP job intents *registered* | **7**, all Document. Slides *declares* seven more (`SlideInternalJobIntent`) that nothing registers |
| Deferred endpoints | **1** (`POST /audit`) |
| Retention ports | **11**, in a fixed order (`startBackend.ts:123-147`) |
| Backend TypeScript | **236 files / 47,936 lines** |
| Module `docs/` packages | **19** (114 markdown files) — Slides is the only module without one |

---

## 11. What the remaining work needs

Ordered by how little stands between the current tree and the item being usable. Each row lists
only artifacts that are **verifiably absent from the tree today** — no design is proposed here,
and no row claims to know what the owner intends to build next.

| # | Item | What is missing at `ef6d462` |
| --: | --- | --- |
| 1 | **Slides → reachable** | An `application/` service, an `index.ts` barrel, `#slides`/`#slides/*` aliases in both `package.json` and `tsconfig.json`, `1-init/create/slides.ts`, `4-job-wiring/slides/`, construction and `register…Endpoints` lines in `startBackend.ts`, and a `docs/` package. The domain (11 files), persistence (3) and port (1) already exist and 87 tests already pass against them. *Work exists on `origin/main` and `slides-phase2` that is not an ancestor of `HEAD`* — see [§1](#1-scope-this-page-describes-local-main-at-ef6d462-and-nothing-else) |
| 2 | **Knowledge → tested** | A `knowledge*.test.ts`. Nothing else; the module is already built, wired and load-bearing. It is the largest untested surface that production code depends on |
| 3 | **Presence → reachable** | A transport that carries a trusted session identity. The current transport registers one route (`app.all("/*")`) and has no session concept. Also: something that calls `removeExpired`, which today has zero production callers |
| 4 | **Research** | A `WebRetrieval` platform boundary with actual types (`0-platform/web-retrieval` has 0 TypeScript files), then `research/` and `sources/` capability directories, neither of which exists |
| 5 | **Analysis, Spreadsheet, Workspace, Automation** | Everything. No directory, no port, no type, no test, no reference in `src/` |
| 6 | **Agents** | Present on the `agents-capability` branch only (41 files at `0e147d1`), which is not an ancestor of `HEAD` or of `origin/main`. Nothing of it is on `main` |

Two cross-cutting items that block nothing but change every number on this page if they land:

- **CI.** There is no `.github/`, no pipeline file of any kind, tracked or untracked. Nothing
  enforces `pnpm test` or `pnpm typecheck` — see
  [10-verified-status.md §7](10-verified-status.md#7-there-is-no-ci).
- **Typechecking `test/`.** `tsconfig.json`'s `include` is `["src/**/*.ts"]`, so 16,502 lines of
  test code are never compiled. Pointing `tsc` at them today reports 37 errors across 9 of the 26
  files — [10-verified-status.md §6.2](10-verified-status.md#62-test-is-never-typechecked).

---

## Related pages

- [10-verified-status.md](10-verified-status.md) — the measurements this page's statuses rest on
- [11-known-issues.md](11-known-issues.md) — the defects in the capabilities marked *built*
- [07-capabilities/README.md](07-capabilities/README.md) — one page per capability
- [07-capabilities/slides.md](07-capabilities/slides.md) — the unreachable one, in detail
- [00-orientation.md](00-orientation.md) — the tree and where each layer lives
