# Source-scoped retrieval (Slice C) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add retrieval that ranks a query **only within a caller-supplied allow-set of sources**, so a prompt block whose context resolves to specific sources retrieves from exactly those and nothing else. This is the knowledge-capability primitive; the `includes − excludes → allow-set` math and its use by prompt resolution are Slices E.

**Architecture:** A new `Knowledge.RetrieveScopedMany` resolves each allowed `Origin{SourceType,SourceID}` to its internal `LocalRefID` (via the existing `SourceByOrigin`), loads just those sources' windows (via `SourceWindows`), and ranks/pools them exactly — reusing the existing `poolRankings`/`regionsFor` path and bypassing directed descent (the candidate set is already bounded). An empty allow-set returns no regions (the scope admits nothing). A nil allow-set is not accepted here — whole-project retrieval remains `RetrieveMany`.

**Tech Stack:** Go, `core/capability/knowledge` (embedder-backed; deterministic-plumbing tests use the existing fake embedder).

## Global Constraints

- Capabilities never import each other. This slice is entirely within `core/capability/knowledge`.
- Verbatim `*.go.md` companions in the same commit; `gofmt` before regen; `knowledge.go.md` is multi-section — hand-edit changed/added blocks only.
- One `docs/records/NNNN-*.md`.
- TDD: failing test first. Quality of *ranking* is a live concern, but *scoping* (which windows are eligible) is deterministic plumbing and is unit-tested with the fake embedder already used in `knowledge_test.go`.

---

## File structure

- `core/capability/knowledge/knowledge.go` (modify) — add `Origin`, `RetrieveScopedMany`, and a small `windowsForOrigins` helper.
- `core/capability/knowledge/knowledge_test.go` (modify) — scoped-retrieval unit tests over the fake embedder + memory store.
- `docs/records/NNNN-source-scoped-retrieval.md` (create).

No new files; no store-interface change (reuses `SourceByOrigin` + `SourceWindows`).

---

## Task C1: `Origin` type + `windowsForOrigins` helper

**Files:**
- Modify: `core/capability/knowledge/knowledge.go`
- Test: `core/capability/knowledge/knowledge_test.go`

**Interfaces:**
- Produces:
  - `type Origin struct { SourceType string; SourceID string }`
  - unexported `func (k *Knowledge) windowsForOrigins(projectID string, allow []Origin) ([]Window, error)`.

- [ ] **Step 1: Write the failing test**

Add to `knowledge_test.go` (follow the file's existing setup helper that builds a `*Knowledge` with the fake embedder + `MemoryStore`, and `Add`s sources):

```go
func TestWindowsForOriginsFiltersToAllowedSources(t *testing.T) {
	k, _ := newTestKnowledge(t) // existing helper: fake embedder + memory store
	ctx := context.Background()
	// Two distinct sources with distinguishable content.
	if _, err := k.Add(ctx, "p", SourceTypeConnector, "A", "alpha content about apples", nil, 1); err != nil {
		t.Fatalf("add A: %v", err)
	}
	if _, err := k.Add(ctx, "p", SourceTypeConnector, "B", "beta content about bicycles", nil, 1); err != nil {
		t.Fatalf("add B: %v", err)
	}

	only := []Origin{{SourceType: SourceTypeConnector, SourceID: "A"}}
	ws, err := k.windowsForOrigins("p", only)
	if err != nil {
		t.Fatalf("windowsForOrigins: %v", err)
	}
	if len(ws) == 0 {
		t.Fatal("expected windows for source A")
	}
	// Every returned window must belong to A's local ref, never B's.
	srcA, _, _ := k.store.SourceByOrigin("p", SourceTypeConnector, "A")
	for _, w := range ws {
		if w.LocalRefID != srcA.LocalRefID {
			t.Fatalf("leaked a window from another source: %+v", w)
		}
	}
	// Unknown origins contribute nothing (not an error).
	none, err := k.windowsForOrigins("p", []Origin{{SourceType: "connector", SourceID: "ghost"}})
	if err != nil || len(none) != 0 {
		t.Fatalf("unknown origin: len=%d err=%v", len(none), err)
	}
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `go test ./core/capability/knowledge/ -run TestWindowsForOrigins`
Expected: FAIL — `Origin`/`windowsForOrigins` undefined.

- [ ] **Step 3: Implement**

Add to `knowledge.go`:

```go
// Origin names one source by its public (type, id) identity — the addressing the
// caller knows, before the lattice's internal LocalRefID.
type Origin struct {
	SourceType string
	SourceID   string
}

// windowsForOrigins loads exactly the windows belonging to the given sources,
// skipping origins that are not registered. It never reads other sources.
func (k *Knowledge) windowsForOrigins(projectID string, allow []Origin) ([]Window, error) {
	seen := make(map[string]bool, len(allow))
	var out []Window
	for _, o := range allow {
		src, ok, err := k.store.SourceByOrigin(projectID, o.SourceType, o.SourceID)
		if err != nil {
			return nil, err
		}
		if !ok || seen[src.LocalRefID] {
			continue
		}
		seen[src.LocalRefID] = true
		ws, err := k.store.SourceWindows(src.LocalRefID)
		if err != nil {
			return nil, err
		}
		out = append(out, ws...)
	}
	return out, nil
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `go test ./core/capability/knowledge/ -run TestWindowsForOrigins`
Expected: PASS.

- [ ] **Step 5: Companion**

Hand-edit `knowledge.go.md` to add the new `Origin` type and `windowsForOrigins` blocks verbatim in source order.

- [ ] **Step 6: Commit**

```bash
git add core/capability/knowledge/knowledge.go core/capability/knowledge/knowledge.go.md core/capability/knowledge/knowledge_test.go
git commit -m "Add Origin + windowsForOrigins scope helper to knowledge"
```

---

## Task C2: `RetrieveScopedMany`

**Files:**
- Modify: `core/capability/knowledge/knowledge.go`
- Test: `core/capability/knowledge/knowledge_test.go`

**Interfaces:**
- Consumes: `windowsForOrigins`, the embedder, `poolRankings`, `regionsFor`, `Identities`.
- Produces: `func (k *Knowledge) RetrieveScopedMany(ctx context.Context, projectID string, queries []string, topK int, allow []Origin) (RetrieveResult, error)`.

- [ ] **Step 1: Write the failing test**

```go
func TestRetrieveScopedManyRanksOnlyWithinScope(t *testing.T) {
	k, _ := newTestKnowledge(t)
	ctx := context.Background()
	k.Add(ctx, "p", SourceTypeConnector, "A", "apples are a red fruit", nil, 1)
	k.Add(ctx, "p", SourceTypeConnector, "B", "bicycles have two wheels", nil, 1)

	// Scope to B only; a query about apples must still only surface B's source.
	res, err := k.RetrieveScopedMany(ctx, "p", []string{"tell me about fruit"}, 5,
		[]Origin{{SourceType: SourceTypeConnector, SourceID: "B"}})
	if err != nil {
		t.Fatalf("scoped retrieve: %v", err)
	}
	for _, r := range res.Regions {
		if r.SourceID != "B" {
			t.Fatalf("region leaked from %q; scope was B-only", r.SourceID)
		}
	}

	// Empty allow-set → no regions.
	empty, err := k.RetrieveScopedMany(ctx, "p", []string{"anything"}, 5, nil)
	if err != nil {
		t.Fatalf("empty scope: %v", err)
	}
	if len(empty.Regions) != 0 {
		t.Fatalf("empty scope returned %d regions", len(empty.Regions))
	}
}
```

(The fake embedder makes ranking deterministic; the assertion is on *membership*, not relevance quality.)

- [ ] **Step 2: Run to verify it fails**

Run: `go test ./core/capability/knowledge/ -run TestRetrieveScopedMany`
Expected: FAIL — undefined.

- [ ] **Step 3: Implement**

```go
// RetrieveScopedMany ranks the queries only within the allowed sources. An empty
// allow-set yields no regions. It bypasses directed descent: the candidate set is
// already bounded to the scope, so it ranks those windows exactly.
func (k *Knowledge) RetrieveScopedMany(ctx context.Context, projectID string, queries []string, topK int, allow []Origin) (RetrieveResult, error) {
	if topK <= 0 {
		topK = defaultTopK
	}
	if len(allow) == 0 {
		return RetrieveResult{Mode: "scoped"}, nil
	}
	qs := make([]string, 0, len(queries))
	for _, q := range queries {
		if strings.TrimSpace(q) != "" {
			qs = append(qs, q)
		}
	}
	if len(qs) == 0 {
		return RetrieveResult{}, nil
	}

	emb, err := k.embedder.Embed(ctx, qs)
	if err != nil {
		return RetrieveResult{}, err
	}
	usage := emb.Usage
	if len(emb.Vectors) == 0 {
		return RetrieveResult{Usage: usage}, nil
	}

	// Same-identity guard as the unscoped path: refuse cross-space comparison.
	identities, err := k.store.Identities(projectID)
	if err != nil {
		return RetrieveResult{}, err
	}
	for _, id := range identities {
		if id != (VectorIdentity{}) && id != emb.Identity {
			return RetrieveResult{}, ErrIdentityMismatch
		}
	}

	windows, err := k.windowsForOrigins(projectID, allow)
	if err != nil {
		return RetrieveResult{}, err
	}
	if len(windows) == 0 {
		return RetrieveResult{Mode: "scoped", Usage: usage}, nil
	}

	qvecs := make([][]float64, len(emb.Vectors))
	for i, v := range emb.Vectors {
		qvecs[i] = normalize(v)
	}
	regions, err := k.regionsFor(poolRankings(qvecs, windows, topK))
	if err != nil {
		return RetrieveResult{}, err
	}
	return RetrieveResult{Regions: regions, Mode: "scoped", Usage: usage}, nil
}
```

(Confirm `poolRankings(qvecs [][]float64, windows []Window, topK int) []scoredWindow` and `normalize` signatures against `knowledge.go:716`/`544`; adjust the call to match exactly.)

- [ ] **Step 4: Run to verify it passes**

Run: `go test ./core/capability/knowledge/`
Expected: PASS (whole package green).

- [ ] **Step 5: Companion** — hand-edit `knowledge.go.md` (add the `RetrieveScopedMany` block).

- [ ] **Step 6: Commit**

```bash
git add core/capability/knowledge/knowledge.go core/capability/knowledge/knowledge.go.md core/capability/knowledge/knowledge_test.go
git commit -m "Add RetrieveScopedMany: rank only within an allowed source set"
```

---

## Task C3: Change record

**Files:**
- Create: `docs/records/NNNN-source-scoped-retrieval.md`

- [ ] **Step 1:** Capture *why*: retrieval gains a scoped path that ranks only within a caller-resolved allow-set of `(sourceType, sourceID)` origins, reusing the exact-rank + region-merge path and bypassing descent; empty scope → no regions; the `includes − excludes` resolution and prompt-resolution usage are Slice E. Note this supersedes the inert per-source-revision staleness plumbing (the reference graph, Slice F, keys off scope instead).
- [ ] **Step 2:** Companion-drift check on `knowledge.go`.
- [ ] **Step 3:** Commit `git commit -m "Record NNNN: source-scoped retrieval"`

---

## Self-review

- **Spec coverage:** implements the "Retrieval is scoped to that set" section of the design and underpins acceptance criterion 5 (exact scoping). The `includes − excludes` math is deliberately *not* here — it belongs to the document context model (Slice E), which calls this with the resolved allow-set.
- **Type consistency:** `Origin{SourceType,SourceID}` is the single scope address; `RetrieveScopedMany` mirrors `RetrieveMany`'s shape plus the allow-set; region `SourceID`/`SourceType` (from `regions.go`) are what tests assert on.
- **No placeholders:** real code; the only "confirm signature" note is the `poolRankings`/`normalize` call, which must match the existing internal helpers at `knowledge.go:716`/`544`.
- **Boundary check:** entirely within `knowledge`; no cross-capability import; no store-interface change (reuses `SourceByOrigin` + `SourceWindows`). ✓
