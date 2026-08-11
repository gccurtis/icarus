# 2026-07-28 — Docs phase two: roadmap directory, discrepancies archived, and a backend-request audit that found two stale asks

Follow-up to [the reorganization](2026-07-28-docs-reorganization.md), driven by two questions
from the user: *"Everything in backend requests — are these requests we currently need, or are
some of those old and should be archived?"* and *"didn't I mention getting rid of deferred and
discrepancies?"*

## Structure — nine directories became seven

- **`docs/roadmap.md` → `docs/roadmap/`.** The roadmap is now a directory, and `deferred/`
  folded into it as `deferred-*.md` files with a **What we are not building** table in the
  README. A decision not to build something is a roadmap entry; it does not need its own
  top-level category.
- **`docs/discrepancies/` → `docs/archive/discrepancies/`** (all seven live files). This is
  safe *because* the reorganization rewrote
  [`architecture/document-editor.md`](../../architecture/document-editor.md) — the byte-offset
  anchors, single-atom writes, id-keyed binding, layout-capability gating, and the accepted
  whole-document ceiling are all now documented there, in the file someone actually reads
  before touching the editor, rather than in a parallel directory nobody opened. Seven source
  files that linked to `discrepancies/documents.md` (bridge, schema, types, and companions)
  now link to the architecture doc; the role-vocabulary note in `projects.ts.md` states the
  mapping inline instead of linking away.

`AGENTS.md` and the orientation docs now say where a translation gets recorded: the
architecture doc for the subsystem that performs it, beside the code that does it.

## The backend-request audit — the important part

Every open request was re-verified **against Omega's Go source** rather than against its own
description of Omega. Two were asking for work already done:

### Document presence shipped the day before we asked for it

Omega shipped a per-document presence capability on **2026-07-26**. We filed
`live-collaboration-presence.md` on **2026-07-27** asking for it. Nothing on our side
re-checked, so the ask sat there for a day and a half.

What already exists: `GET /documents/:documentID/collaboration` (per-document, includes the
caller, collapses a user's tabs, project-authorized, capped at 20, and it even returns a
`lastEdit` block we currently derive client-side), plus `PUT`/`DELETE …/presence` and a
**30-second server-side TTL**. The request had also claimed *"Alpha calls all of these"* about
the presence writes — **Alpha has never called them.** We are still polling `GET /sessions`
project-wide and filtering client-side.

So the request was rewritten down to what is genuinely missing — a push channel (there is no
SSE or WebSocket anywhere in Omega) and a `joinedAt`, since `seenAt` is overwritten by every
heartbeat — and dropped to **Low**. The adoption work became
[roadmap §5](../../roadmap/README.md), where it belongs: it is one file, it is unblocked, and
it deletes code (`refreshLastEditor` goes away).

### Per-task persona override is shipped, and we already use it

`POST /agent/plans` and `POST /agent/actions` accept `persona: {personaId, personaVersion}`,
resolve it to an immutable snapshot stored on the task, return it from `GET /agent/tasks/:id`,
and reuse it on retry — so the request's own rule "a task keeps its persona for its whole life"
already holds by construction. `systems/documents/ai-tasks.ts` posts exactly that shape today.
§3.3 is now marked **do-not-build**, and the request is narrowed to the per-turn half, which is
genuinely missing (`PostTurn` binds only `{message, web}` and `chat.Turn` has no persona field).

### Mark validation — still needed, and worse than filed

Every claim re-verified: link `href` still has no scheme check, font family/size are
length-bounded only, `fg`/`bg` marks genuinely go through `validCSSColor`. The audit found **an
additional hole the request missed**: `validateCustomTypography` bounds its `Foreground` and
`Background` by length only and never calls `validCSSColor`, so a payload rejected on an `fg`
*mark* is accepted as a block's *custom typography*. Added to the request — same validator, one
call site away.

## The rule this establishes

Written into the backend-requests README: **verify a request against Omega's source before
filing, and re-audit the open list periodically.** An open ask for something the backend
already built is worse than no ask — it wastes their time and makes the whole list
untrustworthy. That is the same failure mode as a stale doc, which is what this whole
two-part cleanup was about.

## A real backend bug found by refusing to re-run until green

The e2e suite failed on `persona-and-surfaces.spec.ts`. Two things came out of chasing it
instead of retrying:

**The test was under-budgeted.** It waits on real model calls whose inner polls alone allow 60s
(15 + 15 + 30), inside Playwright's **30s default** for the whole test — so the test could time
out while its own assertions were still legitimately waiting, reporting a generic timeout that
hid the actual error. Raised to 150s with the arithmetic written down.

**With the timeout fixed, the real failure surfaced: Omega returns
`500 "chat operation failed"` and never writes an agent turn.** Measured across the dev
stack's log: **5 failures in 125 turns**, at latencies of 5.7s, 5.8s, 14.8s, 16.5s and 62.6s —
a spread that rules out one timeout cause. **All five were turns under a non-default persona;
all 120 default-persona turns succeeded.** Reproduced on a stashed, clean tree, so it predates
this work.

Reading `agent/ask.go`, the likely mechanism is the grounded-answer contract:
`if !output.InsufficientEvidence && len(output.Citations) == 0 → ErrMissingCitation`. Every
project's lattice is empty today (nothing ingests documents — the other open request), so
there is nothing to cite; the only valid answer is `insufficientEvidence: true`, and a model
told to "be concise" is likelier to just answer. Filed as
[`ask-turn-500-missing-citation.md`](../../backend-requests/ask-turn-500-missing-citation.md),
asking Omega to confirm the mechanism, stop turning it into a 500, and make the error
distinguishable from a provider outage.

## Verification

`pnpm check` 0/0 · vitest **350/350** · build clean · companions OK for all four touched
source files. Link integrity across every relative link under `docs/` plus AGENTS.md and
CLAUDE.md: **0 broken**.

e2e: **18/19 consistently, with `persona-and-surfaces` failing roughly 1 run in 3** on the
backend bug above — not fixed here, because it is Omega's to fix, and not papered over.

## Follow-up — the directory's contract made explicit

The user asked to confirm the premise: *"Every file underneath backend-requests is a request to
be completed. Is that correct?"* It is, and all six live issues are represented — but three
things were inconsistent enough to be worth fixing:

- **The README now states the contract in the first line**: every file is one piece of work
  Omega needs to complete, one file = one ask, and when it ships the file leaves. So the length
  of the list is always the amount of outstanding backend work. It also says outright that a
  *defect* (the intermittent 500) is work to be done and belongs here alongside the missing
  capabilities.
- **Header convention unified.** The three requests filed on 2026-07-28 led with a prose
  priority sentence while the older three used `**Priority:** · **Status:** · **Filed:**` plus
  a *Standalone* note. All six now use the older, better form.
- **`persona-override-per-turn-and-task.md` → `persona-override-per-turn.md`.** The per-task
  half was found already shipped, so the filename was advertising an ask that no longer exists.
- Table renumbered 1–6 (a `0` row had been prepended when the bug was filed).

Coverage check, all six accounted for: the Quarterback gap is requests **2 and 3**, the
intermittent 500 is **1**, the mark-payload security hole is **4**, per-turn persona is **5**,
and the presence push channel is **6**. Files on disk: 6. Rows in the table: 6. No orphans in
either direction.

## Follow-up 2 — the directory is now a handover package

The user confirmed the whole directory goes to Omega **as one batch**, and asked that anything
which is really one problem be combined.

**Nothing was merged, and here is the reasoning**, since "combine the duplicates" was the
instruction and this is a deliberate decision not to:

- **1 and 3 look like one problem but need two fixes in two places.** #3 builds an ingestion
  pipeline; #1 changes answer-validation error handling. #3 will probably make #1 mostly
  disappear — but not entirely, because a question that triages as needing retrieval and finds
  nothing relevant hits the citation contract even with a full index. Merging them would bury a
  measured defect inside a feature request, and if Omega shipped the feature the merged file
  would read as done while the 500s continued.
- **2 and 3 are deliberately separate so the cheap one can ship first.** #2 is exposing a field
  that already exists; #3 is a pipeline. Merging them would make the five-minute fix wait for
  the multi-day one, which is the opposite of what we want.

Instead the README gained a **Handover** section: which requests share a symptom, which to do
first and why, that #1 should be **re-measured after #3** rather than worked blind, that #4 is
a small independent security fix which must not queue behind features, and a note that the
per-file context duplication is the standalone rule working as intended rather than the files
contradicting each other. The causal link between #1 and #3 is now stated in **both** files —
it had only been one-directional.
