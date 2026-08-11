# Per-block context selection (Slice E) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each prompt block its own context selection — `include` / `exclude` sets over the document's context variables — resolve it to a source allow-set (`includes − excludes`), and make prompt resolution retrieve **scoped to that set** (Slice C's `RetrieveScopedMany`). Changing a block's selection clears its `ResolvedAt` so the next refresh re-resolves.

**Architecture:** `Block` gains an optional `Context *BlockContext {Include, Exclude []string}` (variable names). A new `set_block_context` changeset op sets it through the full lifecycle. At resolve time, `ResolveBlock` maps the block's included variables to their `BoundResource` origins, subtracts the excluded variables' origins, and — when the block has a selection — calls the retriever's new scoped path; a block with no selection keeps whole-project retrieval. Cross-block staleness on a *variable rebind* or a *connector sync* is driven by the reference graph (Slices F/G), not here; this slice handles the block's own selection change.

**Tech Stack:** Go, `core/capability/document` changeset machinery + prompt resolution; the `Retriever` port; the wiring adapter over `knowledge.RetrieveScopedMany`.

## Global Constraints

- A **new** document op touches all of: `changeset.go` (OpType + fields), `changeset_validate.go`, `changeset_apply.go`, `changeset_inverse.go`, `rebase.go` (footprint), `history.go`, and every place a `Block` is **cloned** (the new `Context` must deep-copy).
- Capabilities never import each other; the `ResourceRef.Kind → knowledge sourceType` mapping lives in the wiring adapter.
- Verbatim `*.go.md` companions same commit; multi-section companions hand-edited; `gofmt` before regen.
- One `docs/records/NNNN-*.md`.
- TDD: failing test first. Retrieval *scoping* is deterministic plumbing (unit-testable with a fake retriever); *quality* is exercised in the live demo (Slice I).

---

## File structure

- `core/capability/document/context.go` (create) — `BlockContext` type + `resolveBlockScope` (variable names → `[]ScopeOrigin`).
- `core/capability/document/model.go` (modify) — `Block.Context *BlockContext`; deep-copy in the block clone path.
- `core/capability/document/changeset.go` (modify) — `OpSetBlockContext` + `ChangeOp.BlockContext *BlockContext`.
- `core/capability/document/changeset_validate.go` (modify) — validate the op.
- `core/capability/document/changeset_apply.go` (modify) — apply sets context + clears `ResolvedAt`.
- `core/capability/document/changeset_inverse.go` (modify) — restore prior context + prior `ResolvedAt`.
- `core/capability/document/rebase.go` (modify) — block-scoped footprint for the op.
- `core/capability/document/history.go` (modify) — the op's affected-IDs projection.
- `core/capability/document/prompt.go` (modify) — extend the `Retriever` port + use scoped retrieval.
- `core/wiring/wiring.go` (modify) — `documentRetriever` implements the scoped method via `knowledge.RetrieveScopedMany`.
- `core/capability/document/*_test.go`, `core/capability/document/prompt_test.go` (modify) — op-lifecycle + scoped-resolution tests with a fake retriever.
- `docs/records/NNNN-per-block-context.md` (create).

---

## Task E1: `BlockContext` model + block clone

**Files:**
- Create: `core/capability/document/context.go`
- Modify: `core/capability/document/model.go`
- Test: `core/capability/document/context_test.go`

**Interfaces:**
- Produces:
  - `type BlockContext struct { Include []string `json:"include,omitempty"`; Exclude []string `json:"exclude,omitempty"` }`
  - `Block.Context *BlockContext `json:"context,omitempty"``
  - `func cloneBlockContext(*BlockContext) *BlockContext`

- [ ] **Step 1: Failing test**

```go
func TestCloneBlockContextIsDeep(t *testing.T) {
	src := &BlockContext{Include: []string{"sales"}, Exclude: []string{"legacy"}}
	cp := cloneBlockContext(src)
	cp.Include[0] = "MUT"
	if src.Include[0] != "sales" {
		t.Fatal("clone shared the include slice")
	}
}
```

- [ ] **Step 2: Run — FAIL.** `go test ./core/capability/document/ -run TestCloneBlockContext`
- [ ] **Step 3: Implement**

`context.go`:

```go
package document

// BlockContext is a prompt block's per-block scope selection over the document's
// declared context variables: the resolved retrieval scope is the union of the
// included variables' sources minus the excluded variables' sources.
type BlockContext struct {
	Include []string `json:"include,omitempty"`
	Exclude []string `json:"exclude,omitempty"`
}

func cloneBlockContext(c *BlockContext) *BlockContext {
	if c == nil {
		return nil
	}
	out := &BlockContext{}
	if len(c.Include) > 0 {
		out.Include = append([]string(nil), c.Include...)
	}
	if len(c.Exclude) > 0 {
		out.Exclude = append([]string(nil), c.Exclude...)
	}
	return out
}
```

Add `Context *BlockContext `json:"context,omitempty"`` to `Block` in `model.go`. Find the block deep-copy site (the function that clones a `Block` / its `Data`; the same place that copies `Atoms`/`Marks`) and set `out.Context = cloneBlockContext(b.Context)`.

- [ ] **Step 4: Run — PASS.** Also run the full document package to confirm no clone path drops the field: `go test ./core/capability/document/`.
- [ ] **Step 5: Companions** `context.go.md`, `model.go.md`.
- [ ] **Step 6: Commit** `git commit -m "Add per-block BlockContext with deep clone"`

---

## Task E2: `resolveBlockScope`

**Files:**
- Modify: `core/capability/document/context.go`
- Test: `core/capability/document/context_test.go`

**Interfaces:**
- Produces:
  - `type ScopeOrigin struct { Kind string; ID string }`
  - `func resolveBlockScope(tmpl *TemplateInfo, ctx *BlockContext) []ScopeOrigin` — union of included variables' `BoundResource`, minus excluded variables' `BoundResource`; skips variables that are unbound or undeclared; deduped.

- [ ] **Step 1: Failing test**

```go
func TestResolveBlockScopeUnionMinusExclude(t *testing.T) {
	tmpl := &TemplateInfo{Variables: []ContextVariable{
		{Name: "a", BoundResource: &ResourceRef{Kind: "connector", ID: "CA"}},
		{Name: "b", BoundResource: &ResourceRef{Kind: "connector", ID: "CB"}},
		{Name: "legacy", BoundResource: &ResourceRef{Kind: "connector", ID: "OLD"}},
		{Name: "freeform", BoundContext: "no resource"}, // unbound → contributes nothing
	}}
	got := resolveBlockScope(tmpl, &BlockContext{Include: []string{"a", "b", "freeform"}, Exclude: []string{"legacy"}})
	// expect {CA, CB} in include order, no OLD, no freeform.
	if len(got) != 2 || got[0] != (ScopeOrigin{"connector", "CA"}) || got[1] != (ScopeOrigin{"connector", "CB"}) {
		t.Fatalf("scope = %+v", got)
	}
	// Excluding a source that was also included removes it.
	got2 := resolveBlockScope(tmpl, &BlockContext{Include: []string{"a", "b"}, Exclude: []string{"a"}})
	if len(got2) != 1 || got2[0].ID != "CB" {
		t.Fatalf("exclude-of-include failed: %+v", got2)
	}
}
```

- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement**

```go
// ScopeOrigin is a resolved source address for scoped retrieval.
type ScopeOrigin struct {
	Kind string
	ID   string
}

// resolveBlockScope computes includes − excludes over the template's variable
// bindings. Unbound or undeclared variables contribute nothing.
func resolveBlockScope(tmpl *TemplateInfo, ctx *BlockContext) []ScopeOrigin {
	if tmpl == nil || ctx == nil {
		return nil
	}
	bind := func(name string) (ScopeOrigin, bool) {
		v := tmpl.contextVariable(name)
		if v == nil || v.BoundResource == nil || v.BoundResource.ID == "" {
			return ScopeOrigin{}, false
		}
		return ScopeOrigin{Kind: v.BoundResource.Kind, ID: v.BoundResource.ID}, true
	}
	excluded := make(map[ScopeOrigin]bool)
	for _, name := range ctx.Exclude {
		if o, ok := bind(name); ok {
			excluded[o] = true
		}
	}
	var out []ScopeOrigin
	seen := make(map[ScopeOrigin]bool)
	for _, name := range ctx.Include {
		o, ok := bind(name)
		if !ok || excluded[o] || seen[o] {
			continue
		}
		seen[o] = true
		out = append(out, o)
	}
	return out
}
```

- [ ] **Step 4: Run — PASS.**
- [ ] **Step 5: Companion + commit** `git commit -m "Resolve per-block scope as includes minus excludes"`

---

## Task E3: The `set_block_context` op (full lifecycle)

**Files:**
- Modify: `changeset.go`, `changeset_validate.go`, `changeset_apply.go`, `changeset_inverse.go`, `rebase.go`, `history.go`
- Test: the matching `*_test.go` for each stage

**Interfaces:**
- Produces: `OpSetBlockContext OpType = "set_block_context"`; `ChangeOp.BlockContext *BlockContext`; applying it sets `block.Context` and clears the block's `PromptData.ResolvedAt`; the inverse restores both.

- [ ] **Step 1: Failing test (apply + ResolvedAt clear)**

```go
func TestApplySetBlockContextClearsResolvedAt(t *testing.T) {
	// a document with one prompt block that has a non-zero ResolvedAt
	base := singlePromptBlockBase(t, "b1", time.Unix(10, 0).UTC()) // test helper: builds Base with a resolved prompt block
	op := ChangeOp{Op: OpSetBlockContext, BlockID: "b1", BlockContext: &BlockContext{Include: []string{"sales"}}}
	next, err := applyOp(base, op)
	if err != nil {
		t.Fatalf("apply: %v", err)
	}
	blk := findBlock(next, "b1")
	if blk.Context == nil || len(blk.Context.Include) != 1 {
		t.Fatalf("context not set: %+v", blk.Context)
	}
	if pd, _ := blk.Data.(PromptData); !pd.ResolvedAt.IsZero() {
		t.Fatalf("ResolvedAt not cleared: %v", pd.ResolvedAt)
	}
}
```

- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement across the lifecycle**
  - **`changeset.go`:** add `OpSetBlockContext OpType = "set_block_context"` to the op list (with a one-line doc comment) and `BlockContext *BlockContext `json:"blockContext,omitempty"`` to `ChangeOp`.
  - **`changeset_validate.go`:** validate `op.BlockID` non-empty and that a block with that id exists; the context (if present) has no blank names and no name in both include and exclude. (Variable existence is *not* required at validate — an unknown name simply contributes nothing at resolve.)
  - **`changeset_apply.go`:** locate the block by id (mirror how `set_block`/`set_prompt` find their block); set `Context = cloneBlockContext(op.BlockContext)`; if the block is a prompt block, clear `PromptData.ResolvedAt` (mirror the clear at `changeset_apply.go:526`). Unknown block → `ErrConflict`.
  - **`changeset_inverse.go`:** capture the block's prior `Context` and prior `PromptData.ResolvedAt`; emit an inverse op that restores them. (Mirror `set_prompt`'s inverse, which restores prior prompt data.)
  - **`rebase.go`:** give the op a **block-scoped footprint** (it touches exactly `op.BlockID`), mirroring `set_prompt`/`assign_block_style`. This lets it rebase disjointly against edits to other blocks.
  - **`history.go`:** include `op.BlockID` in the op's affected stable IDs, mirroring other block-scoped ops.
- [ ] **Step 4: Run — PASS**, then the whole package under race: `go test -race ./core/capability/document/`.
- [ ] **Step 5: Companions** for all six changed files (multi-section — hand-edit).
- [ ] **Step 6: Commit** `git commit -m "Add set_block_context op across the changeset lifecycle"`

---

## Task E4: Scoped retrieval in prompt resolution

**Files:**
- Modify: `core/capability/document/prompt.go`, `core/wiring/wiring.go`
- Test: `core/capability/document/prompt_test.go`

**Interfaces:**
- Extends the `Retriever` port:
  - `RetrieveScoped(ctx context.Context, projectID string, queries []string, topK int, allow []ScopeOrigin) ([]EvidenceSpan, Usage, error)`
- `ResolveBlock` calls `RetrieveScoped` when the block has a non-empty resolved scope, else `Retrieve` (unchanged whole-project path).

- [ ] **Step 1: Failing test**

Using a fake `Retriever` that records which method was called and with what allow-set:

```go
func TestResolveBlockUsesScopedRetrievalWhenBlockHasContext(t *testing.T) {
	fake := &recordingRetriever{} // implements Retriever; captures last allow-set
	docs := newPromptDocs(t, fake) // helper: Documents wired with fake retriever + fake prompt model
	// document with a bound variable "sales" -> connector CA, and a prompt block including it
	id := seedScopedPromptDoc(t, docs, "sales", ResourceRef{Kind: "connector", ID: "CA"}, []string{"sales"})
	if _, err := docs.ResolveBlock(context.Background(), projectID, id, "b1", ResolveReload); err != nil {
		t.Fatalf("resolve: %v", err)
	}
	if !fake.scopedCalled {
		t.Fatal("expected RetrieveScoped to be used")
	}
	if len(fake.lastAllow) != 1 || fake.lastAllow[0] != (ScopeOrigin{"connector", "CA"}) {
		t.Fatalf("allow-set = %+v", fake.lastAllow)
	}
}

func TestResolveBlockFallsBackToWholeProjectWithoutContext(t *testing.T) {
	fake := &recordingRetriever{}
	docs := newPromptDocs(t, fake)
	id := seedPlainPromptDoc(t, docs, []string{}) // prompt block, no context selection
	docs.ResolveBlock(context.Background(), projectID, id, "b1", ResolveReload)
	if fake.scopedCalled {
		t.Fatal("expected whole-project Retrieve, not scoped")
	}
}
```

- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement**
  - Add `RetrieveScoped` to the `Retriever` interface (`prompt.go:71`).
  - In `ResolveBlock`, after planning queries (around `prompt.go:193`), compute `scope := resolveBlockScope(doc.Base.Template, block.Context)`. If `len(scope) > 0`, call `d.retriever.RetrieveScoped(ctx, projectID, queries, d.promptTopK, scope)`; else the existing `d.retriever.Retrieve(...)`. The rest of resolution (synthesize, incorporate) is unchanged.
  - **Wiring adapter** (`documentRetriever` at `wiring.go:713`): implement `RetrieveScoped` by mapping each `document.ScopeOrigin{Kind,ID}` to a `knowledge.Origin{SourceType: kind, SourceID: id}` (kind maps 1:1 to sourceType for `document`/`connector`) and calling `know.RetrieveScopedMany`; map the returned `Region`s to `[]document.EvidenceSpan` with the **same** mapping the existing `Retrieve` adapter uses.
  - Update every other `Retriever` implementation (test fakes across the package) to satisfy the new method.
- [ ] **Step 4: Run — PASS**, then `go build ./...` and `go test ./core/capability/document/ ./core/wiring/... ./core/transport/...`.
- [ ] **Step 5: Companions** `prompt.go.md`, `wiring.go.md` (multi-section).
- [ ] **Step 6: Commit** `git commit -m "Resolve prompt blocks against their scoped context"`

---

## Task E5: dev-test — swap changes output

**Files:**
- Create/modify: `dev-test/prompt/` or a new `dev-test/context-scope/run.sh`

- [ ] **Step 1:** (Live, skip-on-no-key — this exercises the model.) Create two connectors A and B with distinguishable content synced (Slice B); declare two variables bound to A and B; create a prompt block including the A-variable; resolve; capture output. Then `set_block_context` to include the B-variable instead (and confirm the op cleared `ResolvedAt`); resolve `refresh`; assert the output changed and now reflects B. Add an exclude case: include an "everything"-style variable and exclude B; assert B's content never appears.
- [ ] **Step 2:** Run it; it must `track_usage`/`usage_summary` (real model calls). Assert on scope membership (which source's content appears), not on exact wording.
- [ ] **Step 3:** `go vet ./... && ./dev-test/run.sh` (the suite skips when no key).
- [ ] **Step 4:** Commit `git commit -m "Add context-scope dev-test: swap and exclude change output"`

---

## Task E6: Change record

- [ ] Create `docs/records/NNNN-per-block-context.md`: *why* — each prompt block declares its own `include`/`exclude` over document variables; scope = `includes − excludes` resolved to source origins; resolution retrieves scoped (Slice C) or whole-project when unset; the new `set_block_context` op rides the full changeset lifecycle and clears the block's `ResolvedAt`; cross-block staleness (variable rebind, connector sync) is driven by the reference graph (F/G). Satisfies acceptance criteria 4 and 5.
- [ ] Companion-drift check across all changed `core/**`.
- [ ] Commit `git commit -m "Record NNNN: per-block context selection"`

---

## Self-review

- **Spec coverage:** implements "Scope is includes − excludes", "document-declared, block-selected", "Retrieval is scoped", and "Changing context marks blocks stale" (self-block). Satisfies acceptance criteria 4 (selection change → output change via cleared ResolvedAt) and 5 (exact scoping incl. exclude). Cross-block staleness is F/G by design.
- **Op-lifecycle completeness:** `set_block_context` is added to changeset.go, validate, apply, inverse, rebase footprint, history, **and** the block clone path — the full checklist for a new op.
- **Type consistency:** `BlockContext{Include,Exclude}`, `ScopeOrigin{Kind,ID}` used identically in model, op, resolver, and the `Retriever.RetrieveScoped` signature; the wiring adapter maps `ScopeOrigin → knowledge.Origin` 1:1.
- **No placeholders:** real code for model, scope resolution, and the resolve-path switch; test helper names (`applyOp`, `findBlock`, `seedScopedPromptDoc`, `recordingRetriever`) must match/where-absent be added to the package's test utilities — flagged, not invented.
- **Boundary check:** document imports no knowledge types; the `ScopeOrigin → knowledge.Origin` mapping lives in the wiring adapter. ✓
