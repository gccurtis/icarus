# Document backend roadmap

Status: active roadmap, updated through R5 on 2026-07-23.

This roadmap turns the
[Document backend alignment gaps](document-backend-alignment-gaps.md) into
small, executable increments. The
[Document backend checklist](checklists/document-backend.md) is the live record
of progress. This page owns direction and dependency order; it is not a claim
that future work is already implemented.

## Working rules

- Preserve `Document → Base → Rows → Blocks → Atoms + Marks`.
- Keep every accepted mutation as an ordered, typed ChangeSet.
- Prefer one independently testable behavior per increment.
- Do not add fields before an executable behavior consumes them.
- Treat code, tests, registered endpoints, and current architecture docs as the
  implementation truth.
- Update the checklist, current architecture documentation, companion docs, and
  one change record in the same commit as each implementation increment.
- Revisit later ordering when evidence from an earlier increment changes a
  design assumption.

## Decisions that guide every phase

1. **Pages remain derived.** Canonical layout and flow inputs may expand, but
   mutable Page objects do not enter the aggregate.
2. **Undo and redo remain compensation.** They append explicit inverse
   operations; replay never suppresses an earlier ChangeSet.
3. **Collaboration fails closed.** A stale submission conflicts unless retained
   operation-level preconditions prove a semantic rebase safe.
4. **Attribution is trusted.** Authorship, delegation, model, and task metadata
   come from authenticated server context.
5. **Styles are semantic.** Durable values are bounded domain tokens, never CSS
   classes or arbitrary renderer payloads.
6. **Presence remains ephemeral.** It can observe revisions and use Document
   anchors, but it does not enter Base, History, undo, or reconstruction.
7. **AI uses the ordinary edit path.** Approved AI proposals become typed
   submissions rather than replacing serialized Document state.

## Phase 1 — collaboration correctness

### R1. Revision-bound idempotent submission

Status: **complete** — see
[record 0043](../records/0043-revision-bound-document-submissions.md).

Replace the bare operation-array request with a `ChangeSubmission` carrying a
stable `SubmissionID`, exact `ExpectedRevision`, and typed operations.

The store must atomically deduplicate a submission within its Document and
trusted author scope. An identical retry returns the originally accepted
ChangeSet. Reusing an ID with a different payload conflicts. At this increment,
a stale expected revision returns a bounded conflict with the current revision
and resync point; R4 later admits only the subset proven safe rather than
transparently applying at the latest head.

This increment also moves prompt/system writers onto the same exact-revision
admission contract.

### R2. Inspectable History and explicit redo

Status: **complete** — see
[record 0044](../records/0044-document-history-and-explicit-redo.md).

Add cursor-bounded History list/get queries ordered by ChangeSet sequence. List
responses expose bounded summaries, trusted attribution, lineage, and affected
object IDs without exposing private inverse recipes.

Add an explicit redo command and `RedoOf` lineage while retaining compensation
as the actual state transition. Preserve the current safety boundary: only an
eligible authored head can be compensated. Define pruning so active undo/redo
recipes remain available without making configured History retention
unbounded.

### R3. Fine-grained text and movement

Status: **complete** — see
[record 0045](../records/0045-fine-grained-document-editing.md).

Add UTF-8 text splice with rune-boundary validation and a prior-state
precondition. Add identity-preserving move operations for Rows, Blocks, and
Atoms, followed by Mark update and the smallest useful split/join operations.

Each operation must validate, clone, serialize, invert, replay, summarize, and
report conflicts deterministically.

### R4. Proven semantic rebase

Status: **complete** — see
[record 0046](../records/0046-proven-document-semantic-rebase.md).

Classify operations by whether their preconditions prove they are disjoint from
changes accepted after `ExpectedRevision`. Admit only proven-safe rebases;
otherwise return the same explicit conflict as R1.

This increment is complete only when concurrent tests demonstrate both safe
acceptance of non-overlapping work and rejection of overlapping text,
structure, style, and ordering changes.

## Phase 2 — canonical layout and presentation

### R5. Semantic style registry

Status: **complete** — see
[record 0047](../records/0047-document-semantic-style-registry.md).

R5 added stable Style definitions and Block style references to Base while
preserving Row-, Block-, and Mark-owned local values. It defines bounded
semantic typography, spacing, padding, border, background, tone,
applicability, overrides, and document defaults. Registry mutation,
assignment, override, and replacement are all typed, invertible operations and
participate in History, undo/redo, and semantic rebase.

### R6. Horizontal Row tracks

Persist bounded tracks or proportions keyed by stable Block IDs, including gap
and minimum-width rules. Add atomic adjacent resize, reset, and move-between-row
operations. A Row must reconstruct identically in every renderer.

### R7. Header, Footer, and page flow

Add recurring regions that reuse the ordinary Row/Block/Atom hierarchy. Start
with default Header and Footer regions; add first/odd/even variants only when
the renderer consumes them. Add explicit page break, keep-with-next, and
keep-together intent as bounded typed state.

### R8. Pagination policy version 2

Expand canonical layout inputs to account for semantic typography, wrapping
assumptions, declared/intrinsic Block height, row tracks, recurring regions,
breaks, and continuation. Keep pagination a pure, deterministic projection and
version the policy used to derive it.

## Phase 3 — richer content

### R9. Formula Atom payload

Turn Atom content into a closed typed union while retaining a deterministic
display-text seam. Add Formula binding, dependency versions, typed result or
error, state, and last-good display. Evaluation stays Formula-owned through a
Document-consumed port; accepted results use ordinary revision admission and
trusted system attribution.

### R10. Prompt presentation revisions

Separate immutable generated presentation history from evidence history and
from visible authored content. Preserve current and last-good output. A refresh
against stale or user-edited content produces a proposal instead of overwriting
the visible result, and restoration appends a new revision.

### R11. Block catalog

Add Block families as separate working increments:

1. quote, code, divider, and callout;
2. bulleted, numbered, and checklist lists;
3. tables with stable table/row/cell identity and ordinary contained content;
4. images and admitted embeds using exact external references;
5. equation, chart, and metric presentation.

Each kind must arrive with typed data, bounds, validation, cloning, operations,
inverse behavior, rendering, extraction, and safe fallback behavior. Do not
admit arbitrary JSON payloads.

## Phase 4 — lifecycle, projections, and anchors

### R12. General AI edit proposals

Represent an AI edit as ordinary typed operations against one exact revision.
Review is read-only; approval enters through `ChangeSubmission` with trusted
delegation/model/task attribution. Conflict, History, undo, redo, and Activity
remain the same as for a human edit.

### R13. Presence and revision hints

Add project-scoped sessions with caret/selection state over stable Document
anchors. Activity-tracking middleware bumps `last_activity_at` on mutations; a
sweeper removes stale sessions. Revision hints are a lightweight poll endpoint
for client staleness detection. No realtime protocol yet — polling works.

### R14. Archive and restore

Add a `Lifecycle` state field to Document (`active`, `archived`,
`retention_tombstoned`). Archive hides from `List` but preserves content and
history. Restore returns to `active`. Retention tombstone is a governed
soft-delete — content survives but is invisible, pending a retention policy.

### R15. Duplicate with fresh internal IDs

Deep-copy one exact head into a new independent Document. Every internal ID
(row, block, atom, mark) is regenerated while all cross-references are
preserved. Source provenance is recorded. Committed through the ordinary Create
path with full activity and attribution.

### R16. Template definition and instantiation

Document-owned templates: publish a frozen head as a versioned recipe, then
instantiate into a new Document with fresh IDs. Template lifecycle mirrors
Document lifecycle. Seven operations: preview_publish, publish, get,
plan_instantiation, instantiate, list, set_lifecycle. Instantiation reuses the
duplicate core from R15.

### R17. Exact-head Knowledge extraction

Freeze one head, split into semantic windows by row/block boundaries, embed
through the knowledge lattice, and store as an indexed source. Tracks identity
(document ID, revision) so the lattice can detect and resync stale extractions.

### R18. History comparison

Given two revision heads, produce a structured semantic diff at Row / Block /
Atom / Mark granularity — not raw text. Reports added, removed, moved, and
content-changed items. Bounded: returns `too_large` for massive diffs.

### R19. Document anchors for external references

Define `DocumentAnchor` (head + stable structural target + optional range). Add
`validate_anchor` to verify against an exact head. Rebase anchors across
accepted ChangeSets. Mark deleted targets explicitly `orphaned` — never
silently reattach. Thread content stays outside Document state; this is the
anchor contract only.

## Dependency summary

```text
R1 submission
 ├─> R2 history/redo
 ├─> R3 splice/movement ─> R4 semantic rebase
 └─> R12 AI proposals       └─> R19 comment anchors

R3 ─> R5 styles ─> R8 pagination v2
  └─> R6 row tracks ─┘       └─> R14 archive/restore
       R7 regions/flow ─┘       └─> R16 templates

R1 ─> R9 Formula atoms
R1 ─> R10 Prompt revisions     R15 duplicate (full model: R3+R5+R6+R7+R8)
R3 ─> R11 Block catalog

R1 ─> R13 presence

R11 ─> R17 Knowledge extraction
R3 + R4 ─> R18 history comparison
```

The next implementation target is R14: Archive and restore.
