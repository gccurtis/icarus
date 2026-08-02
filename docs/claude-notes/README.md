# Claude Notes — Backend Codebase

Orientation notes from a full read of `apps/backend` (36,593 lines of source across 193
TypeScript files, plus 9,115 lines across 16 test files and one helper). Written 2026-08-01.

These notes describe **the code that exists**, not the target design. Where the repository's
own design pages describe something different, that divergence is called out rather than
smoothed over.

## What this backend is

A single-process, single-tenant TypeScript service (Fastify + `better-sqlite3` + tsx/tsc)
that hosts an authoring platform: documents, slide decks, structured data, formulas,
prompt-driven derived outputs grounded in a vector-lattice knowledge index, external file
connectors, and a project activity ledger. Everything runs in-process; there is no external
queue, cache, or database server.

The architecture's organising idea is a **numbered layer system** where the digit prefix on
each directory encodes dependency direction, combined with **capability-owned everything** —
each capability owns its domain types, its ports, its SQLite tables, and its own migration
code, and reaches other capabilities only through narrow structural interfaces.

## Reading order

| # | Note | Covers |
| --- | --- | --- |
| — | [00-orientation.md](00-orientation.md) | Repo map, toolchain, how to run and test |
| 1 | [01-layers-and-boundaries.md](01-layers-and-boundaries.md) | The numbered layers, aliases, dependency rules |
| 2 | [02-request-and-job-runtime.md](02-request-and-job-runtime.md) | Transport → registry → dual-queue scheduler |
| 3 | [03-capability-anatomy.md](03-capability-anatomy.md) | The two internal capability shapes and per-file roles |
| 4 | [04-state-and-persistence.md](04-state-and-persistence.md) | Revision models, SQLite conventions, idempotency, CAS |
| 5 | [05-async-attempt-pipeline.md](05-async-attempt-pipeline.md) | Freeze → compute → settle, attempts, outbox, recovery |
| 6 | [06-platform-services.md](06-platform-services.md) | Formula, Rich Text, Knowledge, Intelligence, Observability |
| 7 | [07-capability-inventory.md](07-capability-inventory.md) | Every capability: endpoints, tables, state, status |
| 8 | [08-conventions.md](08-conventions.md) | Idioms to imitate when adding code |
| 9 | [09-verified-status.md](09-verified-status.md) | Build/test/boot status as measured, and stale docs |

Reviews — findings with recommended fixes — live in [review/](review/):

| Review | Covers |
| --- | --- |
| [001-consistency-and-doc-drift.md](review/001-consistency-and-doc-drift.md) | Capability shape, wire validation, stale architecture docs |

If you only read one: [01](01-layers-and-boundaries.md) explains the directory structure,
[03](03-capability-anatomy.md) explains how to add to it, and
[09](09-verified-status.md) tells you what is currently broken.

## The one thing to know first

**These notes are a snapshot taken 2026-08-01 and have since drifted.** They were written
against a tree that did not boot, and they predate five capabilities.

What has changed since:

- **Slide was deleted** (not finished). It was the sole reason the tree did not typecheck or
  boot; both now succeed. Every "Document and Slide…" statement below should be read as
  "Document…", and the Slide sections are historical.
- **Comments, Templates, Investigation, and Persona** were added and are not described here at
  all.
- **Context** collapsed to project-only scope, gained `union`/`difference` composition
  endpoints and a `private` flag.

Treat the structural material — layers, queues, the attempt pipeline, conventions — as
current; it still matches. Treat capability inventories, counts, and status claims as stale.
A full refresh is tracked in `scratch/0-general-updates.md`.

## Relationship to the repo's other documentation

There are four distinct documentation tiers in this repo, with different reliability:

1. **`apps/backend/src/**/docs/`** — per-module packages (`README`, `concepts`, `types`,
   `runtime`, `flows`, `invariants`). These are excellent, current, and unusually
   self-critical — they explicitly label what is *not* implemented. Treat as authoritative
   after the source itself. Present for 14 modules.
2. **`docs/runtime/`, `docs/platform/`** — mirrored-from-Notion architecture pages. These
   define the *intent* behind the layer numbering and are the best statement of the
   deliberate structure. Some describe unbuilt capabilities.
3. **`docs/capabilities-old/`** — superseded capability specs. Historic.
4. **`scratch/`** — active design drafts (activity, findings, comments, hypotheses,
   questions, slides). Ahead of the code.

`docs/architecture.md` and `docs/backend-architecture.md` at the top level are both stale;
see [09-verified-status.md](09-verified-status.md).
