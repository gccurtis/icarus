# Resource-backed context variables (Slice D) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a document's context variable bind to a **resource reference** `(kind, id)` — a connector, a document — instead of only free text, so a variable names *which source* it stands for. This slice extends the data model + the `set_context_variable` op; consuming the reference (scope resolution, scoped retrieval, staleness) is Slice E.

**Architecture:** `ContextVariable` gains an optional `BoundResource *ResourceRef`. The existing `set_context_variable` op is extended to carry a `BoundResource` payload alongside the legacy `BoundContext` free text (the two are mutually exclusive; binding a resource clears free text and vice-versa). The op keeps flowing through the full changeset lifecycle — validate, apply, inverse, rebase footprint, history — exactly as it does today; this slice adds the new field to each stage that already handles the op.

**Tech Stack:** Go, `core/capability/document` changeset machinery.

## Global Constraints

- Any document op touches **changeset.go / changeset_validate.go / changeset_apply.go / changeset_inverse.go / rebase.go (footprint) / history.go**. Because `set_context_variable` already exists, this slice *extends* each place that already handles it — it does not add a new op.
- Verbatim `*.go.md` companions in the same commit; `gofmt` before regen; these are multi-section companions — hand-edit changed blocks.
- One `docs/records/NNNN-*.md`.
- TDD: failing test first.

---

## File structure

- `core/capability/document/template.go` (modify) — `ResourceRef` type; `ContextVariable.BoundResource`; clone/normalize handle it.
- `core/capability/document/changeset.go` (modify) — add `BoundResource *ResourceRef` to `ChangeOp`.
- `core/capability/document/changeset_validate.go` (modify) — validate the resource ref on `OpSetContextVariable`.
- `core/capability/document/changeset_apply.go` (modify) — apply binds the resource (clears free text).
- `core/capability/document/changeset_inverse.go` (modify) — capture/restore the prior `BoundResource`.
- `core/capability/document/*_test.go` (modify) — round-trip + inverse tests.
- `core/handlers/document/document.go` (verify) — the changes endpoint already binds raw `[]ChangeOp`; confirm the new field flows through the JSON (no code change expected).
- `docs/records/NNNN-context-variable-resources.md` (create).

---

## Task D1: `ResourceRef` + `ContextVariable.BoundResource`

**Files:**
- Modify: `core/capability/document/template.go`
- Test: `core/capability/document/template_test.go` (create if absent; else the nearest document test file)

**Interfaces:**
- Produces:
  - `type ResourceRef struct { Kind string `json:"kind"`; ID string `json:"id"` }`
  - `ContextVariable.BoundResource *ResourceRef `json:"boundResource,omitempty"``
  - clone/normalize preserve it.

- [ ] **Step 1: Write the failing test**

```go
func TestContextVariableBoundResourceClonesDeeply(t *testing.T) {
	src := &TemplateInfo{Variables: []ContextVariable{{
		Name: "sales", BoundResource: &ResourceRef{Kind: "connector", ID: "c1"},
	}}}
	cp := cloneTemplateInfo(src)
	cp.Variables[0].BoundResource.ID = "MUTATED"
	if src.Variables[0].BoundResource.ID != "c1" {
		t.Fatal("clone shared the BoundResource pointer")
	}
}
```

- [ ] **Step 2: Run — FAIL** (`ResourceRef`/`BoundResource` undefined). Run: `go test ./core/capability/document/ -run TestContextVariableBoundResource`
- [ ] **Step 3: Implement**

In `template.go`:

```go
// ResourceRef names a resource by its catalog identity. A context variable bound
// to a resource stands for that source at resolve time (Slice E).
type ResourceRef struct {
	Kind string `json:"kind"`
	ID   string `json:"id"`
}
```

Extend `ContextVariable`:

```go
type ContextVariable struct {
	Name          string       `json:"name"`
	Description   string       `json:"description,omitempty"`
	BoundContext  string       `json:"boundContext,omitempty"`
	BoundResource *ResourceRef `json:"boundResource,omitempty"`
}
```

Update `cloneTemplateInfo` to deep-copy `BoundResource` (allocate a new `ResourceRef` per variable when non-nil), and `normalizeTemplateInfo` to trim `BoundResource.Kind`/`ID` and nil it out when both are empty.

- [ ] **Step 4: Run — PASS.**
- [ ] **Step 5: Companion** `template.go.md` (hand-edit changed blocks).
- [ ] **Step 6: Commit** `git commit -m "Add ResourceRef binding to context variables"`

---

## Task D2: Carry `BoundResource` on the op + validate it

**Files:**
- Modify: `core/capability/document/changeset.go` (add field), `core/capability/document/changeset_validate.go`
- Test: `changeset_validate_test.go` (or nearest)

**Interfaces:**
- Consumes: `ResourceRef`.
- Produces: `ChangeOp.BoundResource *ResourceRef`; validation that on `OpSetContextVariable` the ref (when present) has a non-empty kind + id and the named variable exists; free text and resource ref are mutually exclusive.

- [ ] **Step 1: Failing test**

```go
func TestSetContextVariableResourceValidation(t *testing.T) {
	base := Base{Template: &TemplateInfo{Variables: []ContextVariable{{Name: "sales"}}}}
	// Valid: bind a resource to a declared variable.
	ok := ChangeOp{Op: OpSetContextVariable, ContextVarName: "sales", BoundResource: &ResourceRef{Kind: "connector", ID: "c1"}}
	if err := validateOp(base, ok); err != nil { // match the file's validation entrypoint name
		t.Fatalf("valid op rejected: %v", err)
	}
	// Invalid: both free text and a resource ref.
	both := ChangeOp{Op: OpSetContextVariable, ContextVarName: "sales", BoundContext: "x", BoundResource: &ResourceRef{Kind: "connector", ID: "c1"}}
	if err := validateOp(base, both); err == nil {
		t.Fatal("expected rejection when both bindings are set")
	}
	// Invalid: malformed ref.
	bad := ChangeOp{Op: OpSetContextVariable, ContextVarName: "sales", BoundResource: &ResourceRef{Kind: "connector"}}
	if err := validateOp(base, bad); err == nil {
		t.Fatal("expected rejection for empty resource id")
	}
}
```

(Use the actual validation entrypoint/signature from `changeset_validate.go:85`/`:519`.)

- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement**
  - `changeset.go`: add `BoundResource *ResourceRef `json:"boundResource,omitempty"`` to `ChangeOp`, documented beside `ContextVarName`/`BoundContext` (lines 201-204).
  - `changeset_validate.go` (both `OpSetContextVariable` cases at :85 and :519): when `op.BoundResource != nil`, require `Kind` and `ID` non-empty and reject a simultaneous non-empty `op.BoundContext`. Keep the existing name-exists / template-exists checks.
- [ ] **Step 4: Run — PASS.**
- [ ] **Step 5: Companion** (changeset.go.md, changeset_validate.go.md — multi-section, hand-edit).
- [ ] **Step 6: Commit** `git commit -m "Validate resource binding on set_context_variable"`

---

## Task D3: Apply + inverse

**Files:**
- Modify: `core/capability/document/changeset_apply.go:108-119`, `core/capability/document/changeset_inverse.go`
- Test: `changeset_apply_test.go` / `changeset_inverse_test.go`

**Interfaces:**
- Produces: applying the op binds the resource (and clears `BoundContext`); the inverse restores the exact prior binding (free text **or** resource, whichever it was).

- [ ] **Step 1: Failing test**

```go
func TestApplySetContextVariableResourceAndInverse(t *testing.T) {
	base := Base{Template: &TemplateInfo{Variables: []ContextVariable{{Name: "sales", BoundContext: "old free text"}}}}
	op := ChangeOp{Op: OpSetContextVariable, ContextVarName: "sales", BoundResource: &ResourceRef{Kind: "connector", ID: "c1"}}

	next, err := applyOp(base, op) // match the file's apply entrypoint
	if err != nil {
		t.Fatalf("apply: %v", err)
	}
	v := next.Template.contextVariable("sales")
	if v.BoundResource == nil || v.BoundResource.ID != "c1" || v.BoundContext != "" {
		t.Fatalf("bad binding after apply: %+v", v)
	}
	// Inverse restores the prior free text and nils the resource.
	inv := invertOp(base, op) // match the file's inverse entrypoint/signature
	restored, err := applyOp(next, inv)
	if err != nil {
		t.Fatalf("apply inverse: %v", err)
	}
	rv := restored.Template.contextVariable("sales")
	if rv.BoundResource != nil || rv.BoundContext != "old free text" {
		t.Fatalf("inverse did not restore prior binding: %+v", rv)
	}
}
```

- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement**
  - `changeset_apply.go` (the `OpSetContextVariable` block at :108): when `op.BoundResource != nil`, set the variable's `BoundResource` to a **copy** and clear `BoundContext`; else keep the existing free-text path and set `BoundResource = nil`. Preserve the copy-on-write `cloneTemplateInfo` step already there.
  - `changeset_inverse.go`: the inverse of `OpSetContextVariable` currently captures the prior `BoundContext`; extend it to capture the prior `BoundResource` too, and emit an op that restores whichever was set. (Mirror the existing capture-prior-state pattern in that file for this op.)
- [ ] **Step 4: Run — PASS.**
- [ ] **Step 5: Rebase footprint + history**
  - `rebase.go`: confirm `OpSetContextVariable`'s footprint (it is a document-wide/template op, not row-scoped) is unchanged by the new field — the footprint keys off the op type + variable name, not the binding value. Add a rebase test if the file has per-op footprint tests; otherwise verify the existing template-op footprint case still passes.
  - `history.go`: confirm the op's history projection needs no new field (bindings are not surfaced in the public ChangeSet summary); if it summarizes the binding, extend it to describe a resource binding.
- [ ] **Step 6: Companions + commit**

Update `changeset_apply.go.md`, `changeset_inverse.go.md` (and rebase/history companions if touched).

```bash
git add core/capability/document/
git commit -m "Apply and invert resource binding on set_context_variable"
```

---

## Task D4: Change record + full-lifecycle guard

**Files:**
- Create: `docs/records/NNNN-context-variable-resources.md`

- [ ] **Step 1:** Run the whole document package under the race detector: `go test -race ./core/capability/document/`. Expected: green (proves apply/inverse/rebase/history all cohere with the new field).
- [ ] **Step 2:** Write the record: *why* — a context variable can now name a resource, not just free text; the binding rides the existing `set_context_variable` op through the full changeset lifecycle; resource and free-text bindings are mutually exclusive; consumption (scope resolution + scoped retrieval + staleness) is Slice E. Note the JSON is additive/backward-compatible (`boundResource` omitempty), so existing documents and clients are unaffected.
- [ ] **Step 3:** Companion-drift check across all changed `core/capability/document/*.go`.
- [ ] **Step 4:** Commit `git commit -m "Record NNNN: resource-backed context variables"`

---

## Self-review

- **Spec coverage:** implements the "document-declared, resource-backed" half of the Context model (`BoundContext string → (kind,id) ref`). Per-block include/exclude selection and its use are Slice E.
- **Type consistency:** `ResourceRef{Kind,ID}` is the single binding shape on `ContextVariable` and `ChangeOp`; apply/inverse/validate all reference it identically.
- **Op-lifecycle completeness:** the plan explicitly walks validate → apply → inverse → rebase footprint → history for `OpSetContextVariable`, satisfying the repo's "any document op touches all of these" rule. Because the op already exists, each is an extension, not a new case.
- **No placeholders:** real code for the model + apply/inverse; the test entrypoint names (`validateOp`/`applyOp`/`invertOp`) must be matched to the actual function names in each file — flagged rather than invented.
