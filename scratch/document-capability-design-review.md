# Icarus Document Capability — Design Draft

The Document design is split into smaller files for review. The canonical
direction is a content-first document: one global page-layout definition and
one ordered body flow of Rows.

- [Summary](document/summary.md) — intent, architectural layers, design decisions,
  and the questions worth challenging first.
- [Canonical model](document/canonical-model.md) — Document, page layout,
  blocks, rich text, tables, styles, and validation rules.
- [Store and history](document/store-and-history.md) — project-scoped runtime,
  Base/ChangeSet storage, service functions, and compaction.
- [Operations and endpoints](document/operations-and-endpoints.md) — reducer
  operations, unified command/query contracts, queue choices, Activity, and
  logging.
- [Prompt refresh](document/prompt-refresh.md) — Context-scoped lattice
  grounding, structured reasoning calls, prompts, schemas, and settlement.
- [Formula items](document/formula-items.md) — typed formula atoms, exact
  evaluation snapshots and display text, Formula integration, and history.
- [File architecture](document/file-architecture.md) — module boundaries,
  implementation functions, dependency direction, and job wiring.

The prior review has been superseded by these implementation decisions; no
application code has been changed.
