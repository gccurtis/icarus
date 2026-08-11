# Reference graph (Slice F) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Answer one question precisely: **"which prompt blocks depend on source X?"** A prompt block depends on exactly the sources in its resolved scope (Slice E), so the dependency graph is derivable — no separate index to maintain. This slice adds the query; Slice G uses it to drive refresh.

**Architecture:** A read-only `Documents.DependentPrompts(projectID, origin)` scans the project's documents, resolves each prompt block's scope with `resolveBlockScope` (Slice E), and returns the `(documentID, blockID)` locations whose scope contains the origin. It lives in the document capability because it needs document internals (blocks + template); the composition that *acts* on the result (enqueue refresh) is Slice G, kept out of the capability.

**Tech Stack:** Go, `core/capability/document`.

## Global Constraints

- Capabilities never import each other. This query is a pure read over documents; the connector/knowledge side does not appear here.
- Verbatim `*.go.md` companions same commit; multi-section hand-edited.
- One `docs/records/NNNN-*.md`.
- TDD: failing test first. This is deterministic — fully unit-testable.
- **Proto scale note:** the query scans the project's documents on demand. For the proto's small documents this is fine; a persisted incremental index is a future optimization behind the same method signature. Log nothing silently — if a scan is bounded/truncated, `log()` it (there is no truncation in this implementation).

---

## File structure

- `core/capability/document/dependencies.go` (create) — `PromptLocation` + `DependentPrompts`.
- `core/capability/document/dependencies_test.go` (create) — scan/scope-match tests.
- `docs/records/NNNN-reference-graph.md` (create).

Reuses `resolveBlockScope`/`ScopeOrigin` (Slice E), `Documents.List` (`service.go:209`), and the block/template model — no new store methods.

---

## Task F1: `DependentPrompts`

**Files:**
- Create: `core/capability/document/dependencies.go`
- Test: `core/capability/document/dependencies_test.go`

**Interfaces:**
- Consumes: `Documents.List(projectID) ([]Document, error)`, `resolveBlockScope`, `ScopeOrigin`, the block/template model.
- Produces:
  - `type PromptLocation struct { DocumentID string; BlockID string }`
  - `func (d *Documents) DependentPrompts(projectID string, origin ScopeOrigin) ([]PromptLocation, error)`

- [ ] **Step 1: Write the failing test**

```go
func TestDependentPromptsMatchesScope(t *testing.T) {
	d := newTestDocuments(t) // existing helper: memory-backed Documents
	// Doc 1: a prompt block scoped (include "sales" -> connector CA); a plain block.
	doc1 := seedDocWithScopedPrompt(t, d, "sales", ResourceRef{Kind: "connector", ID: "CA"}, "pb1")
	// Doc 2: a prompt block scoped to a different source (connector CB).
	doc2 := seedDocWithScopedPrompt(t, d, "ops", ResourceRef{Kind: "connector", ID: "CB"}, "pb2")

	got, err := d.DependentPrompts(projectID, ScopeOrigin{Kind: "connector", ID: "CA"})
	if err != nil {
		t.Fatalf("DependentPrompts: %v", err)
	}
	if len(got) != 1 || got[0] != (PromptLocation{DocumentID: doc1.ID, BlockID: "pb1"}) {
		t.Fatalf("got %+v; want only doc1/pb1", got)
	}
	// A source nothing depends on yields nothing.
	none, _ := d.DependentPrompts(projectID, ScopeOrigin{Kind: "connector", ID: "GHOST"})
	if len(none) != 0 {
		t.Fatalf("ghost source had dependents: %+v", none)
	}
	_ = doc2
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `go test ./core/capability/document/ -run TestDependentPrompts`
Expected: FAIL — `DependentPrompts`/`PromptLocation` undefined.

- [ ] **Step 3: Implement**

Create `core/capability/document/dependencies.go`:

```go
package document

// PromptLocation names one prompt block by its document and block id.
type PromptLocation struct {
	DocumentID string
	BlockID    string
}

// DependentPrompts returns every prompt block in the project whose resolved
// context scope includes the given origin. A block's scope is includes − excludes
// over the document's context variables (resolveBlockScope), so this is the exact
// "which blocks depend on this source?" query the refresh cascade needs.
//
// It scans the project's documents on demand; for the proto's document sizes this
// is adequate, and the signature admits a persisted index later without a caller
// change.
func (d *Documents) DependentPrompts(projectID string, origin ScopeOrigin) ([]PromptLocation, error) {
	docs, err := d.List(projectID)
	if err != nil {
		return nil, err
	}
	var out []PromptLocation
	for i := range docs {
		doc := docs[i]
		for _, row := range doc.Base.Rows {
			for _, blk := range row.Blocks {
				if blk.Kind != BlockKindPrompt || blk.Context == nil {
					continue
				}
				for _, o := range resolveBlockScope(doc.Base.Template, blk.Context) {
					if o == origin {
						out = append(out, PromptLocation{DocumentID: doc.ID, BlockID: blk.ID})
						break
					}
				}
			}
		}
	}
	return out, nil
}
```

(Confirm the field path to rows/blocks/template on `Document` — it is `doc.Base.Rows` / `doc.Base.Template` if `Document` embeds `Base`; adjust to the actual accessor. `BlockKindPrompt` is at `model.go:293`.)

- [ ] **Step 4: Run to verify it passes**

Run: `go test ./core/capability/document/ -run TestDependentPrompts`
Expected: PASS.

- [ ] **Step 5: Companion** `dependencies.go.md`.

- [ ] **Step 6: Commit**

```bash
git add core/capability/document/dependencies.go core/capability/document/dependencies.go.md core/capability/document/dependencies_test.go
git commit -m "Add DependentPrompts: prompt blocks depending on a source"
```

---

## Task F2: Change record

**Files:**
- Create: `docs/records/NNNN-reference-graph.md`

- [ ] **Step 1:** Capture *why*: dependency is derivable from each prompt block's resolved scope, so the "reference graph" is a read (`DependentPrompts`) rather than a maintained index — no drift, no second source of truth. It scans documents on demand (proto scale note); Slice G consumes it to drive refresh. This supersedes the inert per-source revision plumbing.
- [ ] **Step 2:** Companion-drift check on `dependencies.go`.
- [ ] **Step 3:** Commit `git commit -m "Record NNNN: reference graph"`

---

## Self-review

- **Spec coverage:** implements "Scope is the dependency edge" — the graph is derived from scope, not a separate store. Enables the cascade (Slice G).
- **Type consistency:** `PromptLocation{DocumentID,BlockID}` is the cascade's unit; `ScopeOrigin` (Slice E) is the query key; `resolveBlockScope` is reused verbatim.
- **No placeholders:** real code; the `doc.Base.Rows`/`Template` accessor and test helper names must be matched to the package's actual shapes — flagged.
- **Boundary check:** pure read within `document`; no connector/knowledge import; acting on the result is Slice G in the composition layer. ✓
