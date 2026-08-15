# Icarus persisted data models

This package defines the storage-neutral, current-state TypeScript objects for
Icarus capabilities. It intentionally does not prescribe PostgreSQL tables,
MongoDB collections, JSONB columns, or another backend. A storage adapter maps
each entry in `PersistedModelMap` to the chosen project-scoped persistence
mechanism.

The model set follows current Icarus terminology, uses Taurus Omega as secondary
context, and retains deferred Taurus concepts only in `legacy.ts`.

## Central decision: `RichBlock`

`RichBlock` is the one semantic content primitive shared by all surfaces. The
initial discriminated union covers the four highest-value cases:

- `TextRichBlock`
- `ImageRichBlock`
- `TableRichBlock`
- `LinkRichBlock`

The owner of a block controls its semantic content. The containing surface
controls placement, dimensions, and overflow:

- a document row contains `DocumentBlockPlacement` objects;
- a slide visual contains relative `BlockPlacement` objects;
- a spreadsheet cell contains block references and owns its row/column span;
- a board element contains block placements;
- comments contain exactly one text block;
- Research and Agent Task messages contain ordered block references.

This separation lets the same editor, renderer, resolver, serializer, and
validation rules work everywhere without pretending that a slide frame and a
spreadsheet cell have the same layout model.

## Text: raw intent and accepted display

A text block stores two related representations:

1. `RawTextContent` preserves editable atoms and marks. The starter atom union
   is literal text, formula, and reference. The starter mark union is text
   style, link, and annotation.
2. `TextBlockDisplay` stores the accepted display projection. Formula atoms
   become typed `resolved_value` segments and reference atoms become
   `resolved_reference` segments. Display marks are projected onto offsets in
   the accepted display string.

The raw digest binds the two. A projection can be `pending`, `accepted`,
`stale`, or `failed`, so an edit never requires a fake calculated value. A
spreadsheet calculation record is only an evaluation index pointing back to a
pinned text block and formula atom; the text block remains the authority for
what is displayed.

For example, the raw sequence `Revenue: ` plus a formula atom can resolve to
the display text `Revenue: $4.2M`. The expression remains in the raw atom while
the accepted value, dependencies, diagnostics, and resolution time live in the
display segment.

## Ownership and references

Every block has one `RichBlockOwnerRef`. Other objects can use live or pinned
references:

- a live reference follows the current block revision;
- a pinned reference captures a specific revision for snapshots, receipts, and
  reproducible agent work.

Deep duplication creates new block, atom, mark, row, cell, element, and
placement IDs. It does not silently transfer ownership or reuse mutable child
IDs. Nested block containers, such as table cells and image captions, own their
children through the parent `rich_block` owner variant and must remain acyclic.

`ContentSourceRef` can address whole resources, resource regions, individual
rich blocks or atoms, spreadsheet cells, structured data, analysis results,
derived outputs, and captured URLs. This provides precise formula dependencies,
grounding, and links without coupling the model to a database engine.

## Capability modules

| Module | Persisted concepts |
| --- | --- |
| `core.ts` | IDs, project scope, revisions, references, JSON/domain values, layout primitives |
| `rich-blocks.ts` | universal blocks, atoms, marks, display projections, ownership, placements |
| `authored-resources.ts` | documents, slide decks, workbooks, files, templates |
| `knowledge.ts` | contexts, knowledge lattice artifacts, derived outputs |
| `inquiry.ts` | questions, hypotheses, findings, Research chat, structured data, analysis |
| `agent-tasks.ts` | personas, Agent Tasks and localized chat, tool calls, automation, jobs, translation |
| `collaboration.ts` | project profile, workspace, activity, comments, presence, change feed |
| `legacy.ts` | deferred board and memory models, isolated from the core set |
| `registry.ts` | the complete `PersistedModelMap` used at serialization boundaries |

`chat.ts` contains message-content primitives only. There is deliberately no
generic persisted Chat entity: project chat belongs to Research, while a local
conversation belongs to its `AgentTask`.

## Persistence rules

- The project is the isolation boundary. `projectId` is still present in every
  project-scoped object even if its physical database is already project-bound.
- Mutable aggregates use `revision` for compare-and-swap and `schemaVersion`
  for serialized-shape upcasting.
- This package models only current state. It contains no revision-history
  entities or event-sourced resource copies.
- Stable IDs identify mutable children; fractional `rank` strings provide
  deterministic ordering without rewriting sibling positions.
- `lastMutationId` supports owner-supplied idempotency for block edits.
- Append-only facts, immutable results, and execution receipts are distinct
  from mutable aggregate state and should not be treated as revision history.
- Free-form `JsonObject` fields are extension/receipt boundaries, not a shortcut
  for known domain structure.

## Extending the package

To add a block type, add one discriminated state type to `RichBlockKind` and
`RichBlock`, define which owners and placements accept it, and update runtime
validation in the consuming application. To add a persisted capability, define
its current-state type and register it in `PersistedModelMap`. Existing union
members should not be overloaded with unrelated payloads.

`cross-surface.ts` contains compile-time assertions showing that documents,
slides, spreadsheet cells, comments, Research messages, and Agent Task messages
all converge on the same block contract.

## Validation

Run:

```sh
npm run typecheck
```

The package is compiled with strict optional-property, unchecked-index, and
unused-symbol checks enabled.
