# Document backend alignment gaps

Status: updated through roadmap increment R5 (2026-07-23).

This document records the gap between the implemented Document capability and
the intended backend-owned editing model. It is an assessment, not an
implementation sequence. Use the
[Document backend roadmap](document-backend-roadmap.md) for sequencing and the
[Document backend checklist](checklists/document-backend.md) for live progress.
The code, tests, endpoint registry, and current architecture documentation
remain the implementation truth.

## Bottom line

**The current Document implementation is structurally sound enough to extend into a fast collaborative editor. It does not require a wholesale rewrite.** The central choices are correct: stable Row/Block/Atom/Mark identities, typed operations, atomic ChangeSets, append-only revision order, optimistic compare-and-swap, derived pages, typed Block payloads, and prompt resolution through explicit dependencies.

The work ahead is primarily **additive model completion and protocol hardening**. A few changes affect central types, but they extend the existing hierarchy rather than replace it:

1. Extend `Base` with Header, Footer, and page-flow state.
2. Extend `Atom` into a closed typed payload union for text and Formula content.
3. Extend `BlockData` and the operation vocabulary for the remaining Block families.
4. Strengthen `ChangeSet` submission, conflict, history, undo, and redo semantics.
5. Add an adjacent ephemeral collaboration-presence model that uses Document anchors but is not Document content.

Search and Outline can remain frontend-derived while a complete Document is loaded. Comments can be deferred. They should eventually consume stable Document anchors without owning or changing the Document content model.

## Alignment gaps at a glance

1. **Change submission and collaboration protocol — closed by R1 and R4.**
   Clients declare the revision they edited, retries are idempotent, and only
   semantically proven non-overlapping stale work is admitted.
2. **Undo, redo, and History API — closed by R2.** History is public and
   bounded, undo/redo eligibility is explicit, and both actions append
   compensating revisions with lineage.
3. **Fine-grained editing and movement operations — closed by R3.**
   Text splices carry exact prior-state digests, movement preserves identity,
   Marks update in place, and minimal text Block split/join is invertible.
4. **Semantic styles and complete visual state — closed by R5.** Canonical semantic style definitions, block references, defaults, and bounded overrides now persist in Base and Blocks.
5. **Horizontal Row composition** — Rows contain multiple Blocks but do not retain proportions or complete layout rules.
6. **Header, Footer, and page-flow representation** — page geometry exists, but recurring regions and explicit flow controls do not.
7. **Pagination fidelity** — current pagination is deterministic but uses fixed Row metrics rather than actual content requirements.
8. **Formula atoms and computed presentation** — Formula exists elsewhere but is not connected to Documents.
9. **Core knowledge-worker Block catalog** — paragraphs, headings, and Prompt Blocks are implemented; lists, tables, media, and other essential types are absent.
10. **General AI editing and proposal application** — Prompt resolution exists, but AI cannot propose ordinary typed Document changes.
11. **Prompt presentation history and refresh safety** — Prompt Blocks lack immutable output revisions and proposal-versus-application semantics.
12. **Presence and realtime revision awareness** — no ephemeral participant, cursor, selection, or revision-notification protocol exists.
13. **Lifecycle, duplication, templates, rendering, and extraction** — several backend product operations remain absent.
14. **Reference specification versus implemented truth** — the repository
    treats reference material as aspirational, but the Documents reference page
    itself does not clearly label the implementation status of each capability.
15. **Deferred comments and anchors** — comments may wait, but future anchor validation and rebasing must remain possible.

---

## 1. Change submission and collaboration protocol

Status: **closed** by
[0043 Revision-bound Document submissions](../records/0043-revision-bound-document-submissions.md)
and
[0046 Proven Document semantic rebase](../records/0046-proven-document-semantic-rebase.md).

### Gap

Before R1, `documents.append_changes` accepted only an operation array. The
client did not submit:

- the exact Document revision it observed;
- a stable client submission or idempotency ID.

There is still no first-class action grouping or trusted delegation/AI-task
attribution on accepted ChangeSets. Those are related metadata needs, but they
should not be accepted as arbitrary client assertions.

The old service reloaded and retried against the latest revision. That could not
reliably distinguish an operation intentionally authored against current
content from one produced against stale visible state.

### Implemented closure

R1 added:

```go
type ChangeSubmission struct {
    SubmissionID     string
    ExpectedRevision int64
    Operations       []ChangeOp
}
```

R1 established the contract to:

- accept it exactly once at the declared base;
- return the previously accepted ChangeSet for an identical retry;
- or return an explicit conflict containing the current revision and required
  resync point.

R4 extends that admission boundary without weakening it. For an ordinary stale
submission, the service reconstructs the authored base from retained
ChangeSets, classifies read/write facts for the incoming and intervening
operations, and admits only when every interaction is proven disjoint.
Disjoint UTF-8 splices on the same Atom receive deterministic offset and digest
transformation. Same-property style writes, shared ordering containers,
destructive hierarchy overlap, ambiguous or overlapping text ranges, and
missing retained proof return the original bounded revision conflict. A CAS
race restarts the proof against the newer head.

Accepted ChangeSets now distinguish `AuthoredRevision`, the head the client
observed, from `PriorRevision`, the actual admission head. Undo and redo remain
current-head compensations and are never semantically rebased.

Add `ActionGroupID` only when one user gesture can produce multiple ChangeSets.
Trusted delegation, model, and task attribution should be attached by server
context when those producers exist, not bound from untrusted submission JSON.

### Structural impact

**Extension, not redesign.** `ChangeSet` and the HTTP submission contract gain metadata and preconditions; the stable-ID operation model remains intact.

### Closure evidence

Lost responses can be retried safely, accepted submissions preserve authored
and admitted revisions, concurrent disjoint edits converge, and overlap or
insufficient evidence cannot silently relocate or overwrite intent.

## 2. Undo, redo, and History API

Status: **closed** by
[0044 Document History and explicit redo](../records/0044-document-history-and-explicit-redo.md).

### Gap

Before R2, undo appended server-computed inverse operations only for the
requesting user's current-head revision. The compensation had its own inverse,
so undoing that head performed redo mechanically, but there was no explicit
`documents.redo` contract or `RedoOf` lineage and no public History list/get
surface.

### Recommended undo/redo design

**Keep undo and redo as ordinary compensating ChangeSets containing explicit operations.** Add lineage metadata such as `UndoOf` and `RedoOf`, but do not make an undo a marker that merely causes replay or rebasing to ignore another ChangeSet.

A marker-only suppression model appears simpler, but it creates non-local replay semantics:

- every read, checkpoint, export, comparison, and corruption check must calculate an active/inactive ChangeSet graph rather than fold an ordered operation log;
- undoing creation or deletion affects IDs used by later ChangeSets;
- later changes may depend on the state produced by the supposedly invalidated ChangeSet;
- pruning the referenced ChangeSet could make an undo uninterpretable;
- multiple undo/redo cycles become graph toggles rather than an append-only sequence of actual state transitions;
- the result of applying one ChangeSet no longer depends only on the previous state and its own operations.

Explicit compensation preserves the strongest invariant:

```
state N + ChangeSet N+1 operations = state N+1
```

It also makes rebasing simple: fold every accepted ChangeSet in order, including undo and redo ChangeSets. `UndoOf` and `RedoOf` explain lineage; their operations determine state.

The existing inverse-operation work is therefore useful and should remain. Redo can normally compensate the current-head undo ChangeSet using that ChangeSet's own inverse, or reapply the original operations after exact validation. The former is mechanically uniform.

### Implemented closure

R2 added:

- `documents.history.list`;
- `documents.history.get`;
- `documents.redo`;
- explicit `UndoOf` and `RedoOf` lineage;
- explicit redo eligibility and invalidation semantics (the current head-only
  rule already invalidates redo after a new ordinary edit);
- bounded summaries and affected-object metadata;
- retention rules that keep pending reconstruction detail and the current-head
  compensation recipe while pruning older detail independently from bounded
  lineage summaries.

History pages are newest-first and use document-bound opaque keyset cursors.
Each entry includes trusted author identity, `UndoOf`/`RedoOf`, a bounded
content-free operation summary, affected stable IDs, detail availability, and
viewer-specific `canUndo`/`canRedo`. Full retained ChangeSets have a separate
get route; inverse recipes remain private.

Undo accepts only an ordinary or redo head authored by the caller. Redo accepts
only an undo head authored by the caller. Either action appends the target's
stored inverse as a new revision. Advancing the head with any other edit
invalidates the former redo candidate without suppressing or rewriting history.

### Structural impact

**No structural rewrite.** ChangeSets remain the canonical history unit. Undo and redo are specialized ChangeSet submissions.

### Closed when

History is inspectable, undo and redo are append-only state transitions, collaboration cannot be overwritten, replay remains linear, and checkpointing does not require special suppression logic.

## 3. Fine-grained editing and movement operations

Status: **closed** by
[0045 Fine-grained Document editing](../records/0045-fine-grained-document-editing.md).

### Gap before R3

Before R3, the vocabulary could insert and delete structural objects, but it
lacked first-class movement and replaced an Atom's entire text for normal
typing.

Missing primitives include:

- move Row;
- move Block within or between Rows;
- move Atom;
- splice a UTF-8 text range;
- update a Mark rather than remove and recreate it;
- split and join text Blocks where useful.

Delete-plus-insert is not an adequate substitute for movement when identity is expected to survive movement.

### Implemented closure

R3 added:

- `splice_atom_text` over an exact Atom, lowercase SHA-256 prior-text digest,
  and UTF-8 byte range whose endpoints must be rune boundaries;
- stable-ID `move_row`, `move_block`, and `move_atom` operations guarded by the
  exact source parent and predecessor;
- `update_mark`, guarded by the canonical current Mark digest;
- invertible split/join for the editor's smallest useful shape: adjacent,
  authored, unmarked, single-Atom text Blocks in single-Block Rows.

Every operation participates in validation, cloning, JSON persistence, replay,
History summaries, deterministic conflict reporting, and server-computed exact
compensation. Whole-value `set_atom_text` remains compatible, while ordinary
typing can use the overlap-aware splice form.

### Structural impact

**Operation-vocabulary extension only.** Existing Rows, Blocks, Atoms, and anchors remain valid.

### Closure result

Ordinary typing produces compact operations, moved objects retain identity,
overlap facts are explicit and are now consumed by R4 to prove selected
semantic rebases, and History describes user intent rather than implementation
workarounds.

## 4. Semantic styles and complete visual state

Status: **closed** by
[0047 Document semantic style registry](../records/0047-document-semantic-style-registry.md).

### Gap before R5

Before R5, canonical styling covered inline emphasis/link Marks, Block
horizontal/vertical alignment, and Row height increase. There was no named
semantic style registry or complete visual-state vocabulary.

### Implemented closure

R5 added a Document-owned `StyleRegistry` to `Base`, stable
`StyleDefinition` values, block-kind defaults, and per-Block `StyleRef`
assignments with bounded overrides. The registry complements the existing
Row-, Block-, and Mark-owned values rather than replacing them. Style
mutations are typed ChangeOps and now participate in validation, replay,
server-computed inverse generation, undo/redo, History summaries, semantic
rebase boundaries, and legacy-state normalization. Persisted values remain
semantic tokens rather than renderer payloads.

### Structural impact

**Central additive change to `Base` and `Block`, but no hierarchy change.**
This closes the most important cross-cutting presentation-model gap without
changing the Row/Block/Atom aggregate shape.

### Closure result

Canonical document styling now survives persistence and replay, renderers can
map semantic values independently, and no durable Block presentation state has
to live only in frontend state.

## 5. Horizontal Row composition

### Gap

A Row can contain several Blocks, but it has no canonical proportions, gaps, minimum widths, or resizing semantics. The current model therefore represents membership but not the intended horizontal composition.

### Required change

Store bounded proportions or tracks associated with stable Block IDs. Add atomic operations for resizing adjacent Blocks, resetting proportions, and moving Blocks between Rows.

### Structural impact

**Small extension to `Row` or `RowStyle`.** The existing Row-as-horizontal-composition primitive remains correct.

### Closed when

A multi-Block Row reconstructs identically across clients and renderers, resize gestures become one ChangeSet, and movement preserves Block identity.

## 6. Header, Footer, and page-flow representation

### Gap

`Base` contains page geometry and Rows but no Header, Footer, section/page-break, or keep-flow state.

### Required change

Add canonical Header and Footer regions using the same Row/Block/Atom model
rather than a second rich-text system. Support default and, when needed,
first/odd/even variants. Add explicit page-break and bounded flow attributes
such as keep-with-next and keep-together.

### Structural impact

**Additive change to `Base`.** Reusing ordinary Blocks and Atoms avoids a parallel content hierarchy.

### Closed when

Header/Footer edits are normal ChangeSets, recurring regions render deterministically, page-number fields can later use Formula atoms, and explicit page-flow intent survives all clients.

## 7. Pagination fidelity

### Gap

Pagination is currently deterministic, but every Row height is computed from one fixed maximum font height, fixed padding, and optional added height. It does not account for wrapped text, varying typography, tables, media, continuation, or explicit flow controls.

### Required change

Keep pages derived, but enrich canonical layout inputs so pagination can be deterministic from actual semantic content. The backend need not perform browser pixel layout. It does need a renderer-independent print model that accounts for Block intrinsic or declared height, wrapping assumptions, page breaks, and continuation policy.

### Structural impact

**No change to the principle that pages are derived.** `LayoutRules`, Block layout metadata, and the pagination projection need expansion.

### Closed when

Two conforming renderers derive equivalent page membership from the same head and policy version, without storing mutable Page objects in the Document.

## 8. Formula atoms and computed presentation

### Gap

The repository has Formula evaluation and named values, but Documents accepts only text Atoms. Inline variables, calculations, page-number fields, metrics, and charts cannot yet be represented.

### Required change

Convert Atom payload into a closed typed union, at minimum:

- text payload;
- Formula binding/result payload.

A Formula payload should store expression, expected/render context, typed result or error, dependency versions, state, and last-good display. Evaluation remains Formula-owned and is supplied through a Document-consumed port. Results commit through ordinary ChangeSets.

### Structural impact

**Meaningful extension to `Atom`, but the Atom layer is already the correct location.** Do not replace the hierarchy or create a separate inline-content tree.

### Closed when

Formula content is addressable, replayable, refreshable, conflict-safe, and renderable without Documents reimplementing Formula.

## 9. Core knowledge-worker Block catalog

### Gap

Only paragraph, six heading levels, and Prompt Block are supported. Important backend content structures remain absent.

Priority additions:

1. bulleted, numbered, and checklist lists;
2. quote, code, divider, and callout;
3. table with stable table/row/cell identities;
4. image and admitted embed references;
5. equation, chart, and metric presentation.

### Required change

Add closed Block kinds with typed `BlockData` payloads and corresponding validation, cloning, operation, inverse, rendering, and extraction behavior. Tables should contain ordinary Document content through explicit containment rather than flattening cell text.

### Structural impact

**Expected use of the existing `BlockData` subtype seam.** This is evidence that the current composition design is fundamentally sound.

### Closed when

Each admitted Block type has deterministic serialization, complete operations, inverse behavior, bounds, safe fallbacks, and no untyped arbitrary JSON payload.

## 10. General AI editing and proposal application

### Gap

AI can resolve a Prompt Block, but it cannot propose or apply general Document edits through a reviewable backend contract.

### Required change

Represent an AI edit as a proposal containing ordinary typed ChangeOps against an exact revision. Approval submits those operations through the same validation, conflict, ChangeSet, History, undo, and redo path as human edits. Trusted delegation/model/task attribution belongs on the accepted ChangeSet rather than in client-forgeable content.

### Structural impact

**No new mutation architecture.** AI becomes another producer of typed submissions.

### Closed when

AI can rewrite, restructure, style, or add content without directly replacing serialized Document state or bypassing collaboration rules.

## 11. Prompt presentation history and refresh safety

### Gap

PromptData stores the latest instruction, evidence, sources, output, usage, and resolution time, but it lacks immutable presentation revisions and a safe distinction between a generated proposal and an applied visible result.

### Required change

Add immutable Prompt output presentation revisions and pointers for current and last-good-generated output. If the user edits generated content or the Document advances, refresh should preserve visible content and create a proposal rather than overwrite it. Restoring an old output should append a new restoration revision.

### Structural impact

**Extension to PromptData/BlockData and Prompt operations.** The existing Prompt Block remains the correct owning object.

### Closed when

Refresh failure never blanks valid content, concurrent edits are preserved, outputs can be inspected/restored, and evidence history is not confused with presentation history.

## 12. Presence and realtime revision awareness

### Gap

There is no representation or endpoint for participants, cursor, selection, heartbeat, last observed revision, or realtime revision hints.

### Required change

Add a separate ephemeral collaboration-session component keyed by Document and participant/session. It should use stable Document anchors and revisions but must not be part of `Base`, ChangeSets, History, undo, or durable Document reconstruction.

At minimum support:

- enter/leave or heartbeat;
- participant list;
- caret/selection update;
- expiry;
- latest accepted revision notification or resync hint.

### Structural impact

**Adjacent subsystem, not a Document aggregate rewrite.** Documents should own the anchor semantics it consumes.

### Closed when

Multiple clients receive accurate revision hints and presence, stale sessions expire, presence cannot affect canonical state, and reconnect always converges through the durable Document head.

## 13. Lifecycle, duplication, templates, rendering, and extraction

### Gap

The backend currently creates, lists, gets, renames, and permanently deletes Documents. It does not yet provide:

- archive/restore or governed deletion lifecycle;
- duplicate;
- template definition/instantiation;
- deterministic Markdown/display/print rendering;
- exact-head Knowledge extraction;
- general History and comparison queries.

### Required change

Add these as Document-owned commands and projections. Duplicate and template instantiation must mint fresh internal identities. Rendering and extraction must freeze one exact head and remain bounded and deterministic.

### Structural impact

**API and projection additions.** The existing aggregate and ChangeSet system can support them once the missing content types are present.

### Closed when

The Document capability can be exercised headlessly across its complete lifecycle and produce deterministic outputs for the frontend, Knowledge, and export adapters.

## 14. Reference specification versus implemented truth

### Gap

`docs/reference/capabilities/documents.md` describes StyleRegistry, Formula
atoms, tables, media, comments anchors, rendering, extraction, templates, and
many endpoints that are not currently implemented. Repository guidance already
defines `docs/reference/` as prior design and planning material, but a reader
who lands directly on the Documents page may still mistake the target
architecture for current capability.

### Required change

Maintain a clear status distinction on the reference page or add an implementation matrix:

- implemented;
- partial;
- planned;
- deferred.

The code, tests, and endpoint registry remain current truth.

### Structural impact

None, but this is important for implementation sequencing and agent accuracy.

### Closed when

An implementation agent can determine the current surface and next gaps without reverse-engineering contradictions between code and reference material.

## 15. Deferred comments and anchors

### Gap

Comments are intentionally deferred. Current stable object IDs and Atom-offset anchors provide a usable base, but there is no anchor validation or rebasing contract.

### Required change

Do not add thread content to Documents. Later, add a `DocumentAnchor` value and operations/queries for validating and rebasing anchors across accepted ChangeSets. A Collaboration capability can own threads, replies, resolution, and notifications.

### Structural impact

**Small future anchor contract only.** Deferring comments does not block the current editor foundation.

### Closed when

Comment anchors can survive non-destructive edits, become explicitly orphaned when their target is removed, and never pollute Marks or canonical text.

---

## Structural verdict

### What should remain unchanged

- `Document → Base → Rows → Blocks → Atoms + Marks`.
- Stable server identities.
- Typed `BlockData` composition.
- Typed, atomic ChangeOps.
- Append-only ordered ChangeSets.
- Optimistic canonical revision.
- Base plus pending ChangeSets with background checkpoint/rebase.
- Derived pages rather than persisted Page objects.
- Prompt execution through injected Knowledge and Intelligence dependencies.
- Project-scoped access enforcement outside pure model transformations.

### Central types that need additive expansion

```
Base
├── StyleRegistry
├── Header regions
├── Rows
├── Footer regions
└── richer print/page-flow configuration

Row
├── Blocks
└── stable horizontal tracks/proportions

Block
├── semantic StyleRef
├── richer bounded layout attributes
└── additional typed BlockData variants

Atom
├── Text payload
└── Formula payload

ChangeSet
├── SubmissionID
├── expected/prior revision
├── actor/delegation
├── summary/affected units
├── UndoOf / RedoOf lineage
└── ordered explicit operations
```

## Conclusion

**Foundationally, the model is good.** The missing work is substantial, but it fits the current architecture. The only changes that deserve to be called structural are additions to `Base`, typed Atom payloads, and richer ChangeSet submission metadata. None require abandoning the current hierarchy, persistence strategy, or operation model.

For fast collaborative editing, R1 now provides expected revision, idempotent
submission, and explicit admission conflicts; R2 adds inspectable History and
redo; R3 adds splice, movement, and structural preconditions; and R4 admits
only proven-safe semantic rebases. With that collaboration foundation in
place, semantic styles are the next priority, followed by page regions,
Formula, and additional Blocks.
