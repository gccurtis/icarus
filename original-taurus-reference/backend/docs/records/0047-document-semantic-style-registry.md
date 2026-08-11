# 0047 Document semantic style registry

This increment completes roadmap R5. Documents now own a semantic style registry in canonical state, Blocks can reference named definitions with bounded overrides, and style changes travel through the same typed ChangeSet, undo/redo, History, and semantic rebase machinery as the rest of the aggregate.

## `core/capability/document/style.go`

### Add the semantic style model and normalization rules

```go
type StyleRegistry struct {
	Definitions []StyleDefinition `json:"definitions,omitempty"`
	Defaults    []StyleDefault    `json:"defaults,omitempty"`
}

type BlockStyleRef struct {
	StyleID   string          `json:"styleId,omitempty"`
	Overrides *StyleOverrides `json:"overrides,omitempty"`
}
```

Define bounded semantic typography, spacing, padding, border, background, and tone tokens; the `StyleRegistry`, `StyleDefinition`, `StyleDefault`, `BlockStyleRef`, and override types; validation helpers; usage tracking; cloning; and the `applyStyleOp` entry point.

The goal is to make durable presentation state canonical and renderer-independent without collapsing all styling into renderer payloads or replacing the existing Row/Block/Mark fields.

## `core/capability/document/style.go.md`

### Mirror the new style source verbatim

```md
Current state companion for `style.go`.
```

Add the required companion for the new file so the repository has a byte-accurate current-state description of the semantic style implementation.

## `core/capability/document/document.go`

### Extend Base and Block with semantic style state

```go
type Block struct {
	ID       string         `json:"id,omitempty"`
	Kind     BlockKind      `json:"kind,omitempty"`
	Style    BlockStyle     `json:"style,omitempty"`
	StyleRef *BlockStyleRef `json:"styleRef,omitempty"`
}

type Base struct {
	PageLayout    PageLayout    `json:"pageLayout,omitempty"`
	LayoutRules   LayoutRules   `json:"layoutRules,omitempty"`
	StyleRegistry StyleRegistry `json:"styleRegistry,omitempty"`
	Rows          []Row         `json:"rows,omitempty"`
}
```

Add `Base.StyleRegistry` and `Block.StyleRef`, normalize them on create and read paths, and preserve legacy documents that do not yet carry the new state.

The goal is to make semantic styles part of canonical document state while keeping legacy persisted content readable and keeping local Block alignment style intact.

## `core/capability/document/document.go.md`

### Synchronize the document companion

```md
Current state companion for `document.go`.
```

Regenerate the companion from current source so the new Base and Block state, normalization, and service behavior are documented exactly.

## `core/capability/document/changeset.go`

### Add typed style registry and assignment operations

```go
const (
	OpPutStyleDefinition    OpType = "put_style_definition"
	OpDeleteStyleDefinition OpType = "delete_style_definition"
	OpSetStyleDefault       OpType = "set_style_default"
	OpAssignBlockStyle      OpType = "assign_block_style"
	OpSetBlockStyleOverrides OpType = "set_block_style_overrides"
	OpReplaceStyle          OpType = "replace_style"
)
```

Extend `OpType` and `ChangeOp` with style-definition, default, assignment, override, and replacement operations; validate style-bearing payloads; apply them during replay; compute inverses; and reject Block payloads whose style references do not match the active registry.

The goal is to keep style editing inside the same append-only, invertible operation model rather than introducing side channels for visual state.

## `core/capability/document/changeset.go.md`

### Synchronize the ChangeSet companion

```md
Current state companion for `changeset.go`.
```

Regenerate the companion from current source so the expanded operation vocabulary and validation rules stay exact.

## `core/capability/document/history.go`

### Expose affected style identities in bounded History

```go
type AffectedObjects struct {
	DocumentID string   `json:"documentId,omitempty"`
	RowIDs     []string `json:"rowIds,omitempty"`
	BlockIDs   []string `json:"blockIds,omitempty"`
	AtomIDs    []string `json:"atomIds,omitempty"`
	MarkIDs    []string `json:"markIds,omitempty"`
	StyleIDs   []string `json:"styleIds,omitempty"`
}
```

Extend `AffectedObjects` and summary generation so style mutations and style-bearing Block edits report the style IDs they touch.

This keeps History useful for style editing without exposing private inverse details.

## `core/capability/document/history.go.md`

### Synchronize the History companion

```md
Current state companion for `history.go`.
```

Regenerate the companion from current source so the new style-aware summary behavior is documented exactly.

## `core/capability/document/rebase.go`

### Treat style mutations as semantic read and write facts

```go
case OpPutStyleDefinition, OpDeleteStyleDefinition, OpSetStyleDefault,
	OpAssignBlockStyle, OpSetBlockStyleOverrides, OpReplaceStyle:
	// style-aware footprint logic
```

Classify style-definition updates, default changes, Block style assignment, override changes, and style replacement in the rebase footprint proof, and include Block style references in the stable tree facts.

The goal is to preserve the R4 fail-closed stale-admission contract after style state becomes part of canonical content.

## `core/capability/document/rebase.go.md`

### Synchronize the rebase companion

```md
Current state companion for `rebase.go`.
```

Regenerate the companion from current source so the style-aware proof surface is documented exactly.

## `core/capability/document/document_test.go`

### Prove style state round-trip and legacy reads

```go
func TestStyleRegistryRoundTrip(t *testing.T) {
func TestGetLegacyDocumentWithoutStyleState(t *testing.T) {
```

Add coverage for semantic style registry persistence through document JSON and for loading legacy document state that omits the new fields.

## `core/capability/document/changeset_test.go`

### Prove style lifecycle, conflicts, and rebase boundaries

```go
func TestStyleRegistryLifecycleUndoRedoAndHistory(t *testing.T) {
func TestStyleRegistryValidationAndConflicts(t *testing.T) {
func TestStyleRegistrySemanticRebaseBoundaries(t *testing.T) {
```

Add tests for style definition lifecycle, undo/redo, History summaries, invalid definitions and usages, safe stale text rebases across style changes, and conflicting overlapping style edits.

The goal is to show that style state behaves like first-class document state at the same collaboration boundaries as text and structure.

## `docs/architecture/capabilities/documents/README.md`

### Describe semantic style state in the current model

```md
A `Block` is `{ID, Kind, Style, StyleRef, Inferred, Atoms, Marks, Data}`
```

Update the architecture overview so Base, Block, and the operation vocabulary reflect the implemented style registry, block references, overrides, and replacement semantics.

## `docs/architecture/capabilities/documents/data-model.md`

### Add style registry and style references to the data model

```md
`{ PageLayout, LayoutRules, StyleRegistry, Rows []Row }`
```

Document the new canonical fields on Base and Block so the data model description matches the implementation truth.

## `docs/backend-guide.md`

### Surface style registry behavior in the API guide

```md
GET /documents/:documentID
POST /documents/:documentID/changes
```

Update the practical endpoint summary so readers know resolved documents now include semantic style state and that the change endpoint accepts typed style operations.

## `docs/support/document-backend-roadmap.md`

### Mark R5 complete and advance to R6

```md
Status: **complete**
```

Link this record from the roadmap, summarize what the semantic style increment delivered, and move the next target to horizontal Row tracks.

## `docs/support/checklists/document-backend.md`

### Close the R5 checklist

```md
- [x] **R5. Semantic style registry**
```

Mark all semantic style sub-items complete and move the live focus to R6.

## `docs/support/document-backend-alignment-gaps.md`

### Close the semantic style gap

```md
4. **Semantic styles and complete visual state — closed by R5.**
```

Replace the open-gap description with the implemented closure so the support assessment reflects the new canonical visual-state model.
