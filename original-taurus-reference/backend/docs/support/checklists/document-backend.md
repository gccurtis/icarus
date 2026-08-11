# Document backend implementation checklist

Roadmap: [Document backend roadmap](../document-backend-roadmap.md)

Assessment: [Document backend alignment gaps](../document-backend-alignment-gaps.md)

Current focus: **R6 — horizontal Row tracks**

Completion means the behavior is implemented, tested through the appropriate
boundaries, documented as current state, and captured in a numbered change
record. Parent checkboxes remain open until all of their children are complete.

## Implemented foundation

- [x] Stable Document → Base → Row → Block → Atom hierarchy.
- [x] Stable Row, Block, Atom, and Mark IDs.
- [x] Typed atomic ChangeSets with per-Document sequence and revision CAS.
- [x] Server-computed inverse operations and current-head author-scoped undo.
- [x] Explicit redo by compensating the current authored undo ChangeSet.
- [x] Row height, Block alignment, page geometry, and derived pagination.
- [x] Typed Prompt Block resolution through Document-owned ports.

## Phase 1 — collaboration correctness

- [x] **R1. Revision-bound idempotent submission** —
      [record 0043](../../records/0043-revision-bound-document-submissions.md)
  - [x] Define the minimal `ChangeSubmission` and bounded conflict response.
  - [x] Persist submission identity and payload identity atomically with the
        accepted ChangeSet.
  - [x] Return the original ChangeSet for an identical retry.
  - [x] Reject mismatched ID reuse and stale expected revisions without writes.
  - [x] Move human and trusted system/prompt writers to exact-revision admission.
  - [x] Cover memory store, SQLite, service races, handlers, transport, and the
        executable manual/dev-test path.
  - [x] Update companions, current architecture docs, orientation if needed,
        and the numbered change record.
- [x] **R2. Inspectable History and explicit redo** —
      [record 0044](../../records/0044-document-history-and-explicit-redo.md)
  - [x] Add cursor-bounded History list.
  - [x] Add retained ChangeSet get.
  - [x] Add bounded summaries and affected-object metadata.
  - [x] Add explicit redo and `RedoOf`.
  - [x] Define eligibility, invalidation, and bounded retention.
- [x] **R3. Fine-grained text and movement** —
      [record 0045](../../records/0045-fine-grained-document-editing.md)
  - [x] Add preconditioned UTF-8 text splice.
  - [x] Add Row move.
  - [x] Add Block move within and between Rows.
  - [x] Add Atom move.
  - [x] Add Mark update.
  - [x] Add only the split/join operations exercised by the editor.
- [x] **R4. Proven semantic rebase** —
      [record 0046](../../records/0046-proven-document-semantic-rebase.md)
  - [x] Classify safely rebasable operations.
  - [x] Admit non-overlapping stale submissions.
  - [x] Return bounded conflicts for overlap or insufficient proof.
  - [x] Prove convergence and rejection behavior under concurrent tests.

## Phase 2 — canonical layout and presentation

- [x] **R5. Semantic style registry** —
      [record 0047](../../records/0047-document-semantic-style-registry.md)
  - [x] Define stable semantic Style values and applicability.
  - [x] Add Base registry and Block references without replacing local styles.
  - [x] Add typed registry, assignment, override, and replacement operations.
  - [x] Cover replay, inverse, History, rendering input, and legacy migration.
- [x] **R6. Horizontal Row tracks** —
      [record 0048](../../records/0048-horizontal-row-tracks.md)
  - [x] Define bounded proportions, gaps, and minimum widths.
  - [x] Add adjacent resize and reset operations.
  - [x] Compose movement between Rows with track normalization.
- [x] **R7. Header, Footer, and page flow**
  - [x] Add default recurring regions using ordinary Rows.
  - [x] Add page break, keep-with-next state and operations.
- [x] **R8. Pagination policy version 2**
  - [x] Define renderer-independent content-height and wrapping inputs.
  - [x] Account for tracks, recurring regions, breaks, and continuation.
  - [x] Version the deterministic policy and cross-check conforming projections.

## Phase 3 — richer content

- [x] **R9. Formula Atom payload**
  - [x] Define the closed Atom payload union.
  - [x] Add Formula binding/result/last-good state.
  - [x] Integrate Formula evaluation through a narrow port.
  - [x] Commit accepted refreshes through exact revision admission.
- [x] **R10. Prompt presentation revisions**
  - [x] Separate visible content, generated proposals, and evidence history.
  - [x] Preserve current and last-good generated output.
  - [x] Make stale refresh produce a proposal.
  - [x] Make restore append an immutable presentation revision.
- [x] **R11. Block catalog**
  - [x] Quote, code, divider, and callout.
  - [x] Bulleted, numbered, and checklist lists.
  - [x] Images and admitted embeds.

## Phase 4 — lifecycle, projections, and anchors

- [x] **R14. Archive and restore** — [record 0050](../../records/0050-document-trash-and-restore.md)
  - [x] Add `Lifecycle` state field to Document (`active`, `trashed`).
  - [x] Delete becomes trash; content and history preserved.
  - [x] Restore returns document to active; Purge hard-deletes trashed docs.
  - [x] PurgeStale runs at startup against configured retention period.

- [x] **R15. Duplicate with fresh internal IDs** — [record 0051](../../records/0051-document-duplicate.md)
  - [x] Deep-copy one exact head into a new independent Document.
  - [x] Regenerate every internal ID while preserving all cross-references.
  - [x] Name dedup: "Name (1)", "Name (2)", etc. scoped to project.
  - [x] Record source provenance via activity fact.

- [ ] **R16. Template definition and instantiation**
  - [ ] Add Document-owned Template type with versioned recipes.
  - [ ] Publish a Document head as a Template (capture structure, styles, formulas, layout).
  - [ ] Instantiate a Template into a new Document with fresh IDs (reuse R15 duplicate core).
  - [ ] Support `preview_publish`, `publish`, `get`, `plan_instantiation`, `instantiate`, `list`, `set_lifecycle` operations.
  - [ ] Template lifecycle mirrors Document lifecycle (active, archived).

- [x] **R17. Knowledge extraction with per-source revision** — [record 0052](../../records/0052-knowledge-extraction-revision.md)
  - [x] Revision-tagged source identity in knowledge lattice (one source per document, upserted).
  - [x] EvidenceSpan and SourceVersion carry revision for per-source staleness detection.
  - [x] Refresh gate checks per-source revision equality instead of project-level ChangedSince.
  - [x] Windowing already respects block boundaries (\\n in flat text acts as sentence boundary).

- [x] **R18. History comparison** — [record 0053](../../records/0053-document-history-comparison.md)
  - [x] Structured semantic diff at Row / Block / Atom / Mark granularity.
  - [x] Reports added, removed, moved, and content-changed items with stable IDs.
  - [x] Bounded output: max changes limit + text excerpt capping.
  - [x] Endpoint: GET /documents/:id/diff?old=N&new=M&limit=50

- [x] **R19. Document anchors for external references** — [record 0054](../../records/0054-document-anchors.md)
  - [x] `DocumentAnchor` type: document head, stable structural target (row/block/atom), optional range.
  - [x] `validate_anchor` operation — verify an anchor against the resolved head.
  - [x] Rebase anchors across accepted ChangeSets (mark deleted targets orphaned, update row IDs for moved blocks).
  - [x] Thread content stays outside Document state: anchor contract only.
