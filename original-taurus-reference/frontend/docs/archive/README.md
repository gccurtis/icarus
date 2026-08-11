# Archive — history, not current truth

**Nothing here is current.** Everything dated, superseded, or completed lives in this
directory precisely so that every *other* directory under [`docs/`](../README.md) can be
read as true. Start at [`../orientation/AGENT-ORIENTATION.md`](../orientation/AGENT-ORIENTATION.md);
architecture-as-it-is lives in [`../architecture/`](../architecture/README.md).

| Directory | What is in it |
| --- | --- |
| [`records/`](records/) | Every change record (repo Practice 2) — what changed, when, and why. Written continuously; history the moment it lands. |
| [`plans/`](plans/) | Plans and designs that shipped or were abandoned. Two of them are still the best editor architecture reading in the repo (see below). |
| [`backend-requests/`](backend-requests/) | Asks of Omega that **shipped or were withdrawn**. The live list is [`../backend-requests/`](../backend-requests/README.md) and holds open asks only. |
| [`discrepancies/`](discrepancies/) | Front-end/back-end mismatches that stopped existing. |
| [`integration/`](integration/) | The original Alpha↔Omega integration push, including the superseded UX audit. |
| [`superpowers/`](superpowers/) | Spec/plan scratch from the brainstorming→plan flow; the work landed. |

## Worth reading even though it is archived

- [`plans/2026-07-27-document-subsystem-reorg.md`](plans/2026-07-27-document-subsystem-reorg.md)
  — the document runtime's target model and the settled decisions behind it. The code
  matches it; read it before touching the editor.
- [`plans/2026-07-27-document-subsystem-issues.md`](plans/2026-07-27-document-subsystem-issues.md)
  — the issue catalog behind that reorg, every row closed, each with its location and fix.

## Why records live here

A change record is written on commit-and-push and is *immediately* history — it describes
a moment, not the present. Keeping 137 dated files in a directory a reader scans for
current truth was the single biggest source of "which of these is still real?", so they
moved here on 2026-07-28 with the rest of the dated material.

Practice 2 is unchanged otherwise: keep writing one per push, at
`docs/archive/records/YYYY-MM-DD-<slug>.md`.

## Links inside the archive are not rewritten

A record describes what was true on its date; editing it to look current would be a lie.
When records moved here their relative links were re-pointed **only** where the target
was unambiguous, so a link that 404s means the target moved — look for it by name in this
directory rather than assuming the record is wrong.

## Earlier sweeps

**2026-07-28** — records, the six dated plans, and the loose dated files at this
directory's root were filed into `records/` and `plans/`; two fully-stale discrepancies
(`ai-agent.md`, `document-inspector.md`) joined `document-row-windows.md` under
`discrepancies/`; `docs/reference/` became `docs/support/reference/`.

**2026-07-27** — a large batch moved at once so the live directories contained only what
was still true:

| Moved | Why |
| --- | --- |
| `backend-requests/` (19 files) | Everything **shipped or withdrawn**, so the live list could be trusted at a glance. |
| `integration/` | Its "still needed from the backend" list had gone stale on six of seven items and competed with `../backend-requests/`. |
| `superpowers/` | Spec/plan scratch; the work landed. |
| `plans/2026-07-23-document-pagination-engine.md` | Pagination was **deleted** (reorg workstream B). |
| `plans/2026-07-21-client-runtime-model.md` | Superseded by the reorg's target model. |
| `plans/2026-07-24-data-layer-architecture-migration.md` | The `data/` boundary migration completed. |
| `plans/2026-07-24-slide-editor-fabric.md` | Slides remain a front-end mock; not driving work. |
| `discrepancies/document-row-windows.md` | Row windowing was deleted with pagination — nothing to reconcile. |

**Earlier** — the a2-block-kinds plan and spec (superseded by the landed 7-kind block
model), `2026-07-26-full-integration.md` (replaced by the integration recut), the
Playwright harness design (the harness is now real and runs 19 specs), the
`2026-07-21-next-steps` list, and the slide-editor checklist.
