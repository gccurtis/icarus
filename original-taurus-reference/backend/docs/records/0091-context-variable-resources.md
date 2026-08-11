# Resource-backed context variables (live-document Slice D)

The fourth slice of the live-document program (design:
[`docs/superpowers/specs/2026-07-26-live-document-connectors-design.md`](../superpowers/specs/2026-07-26-live-document-connectors-design.md);
plan: [`docs/superpowers/plans/2026-07-26-resource-backed-context-variables.md`](../superpowers/plans/2026-07-26-resource-backed-context-variables.md)).
It lets a document's context variable name a **resource** instead of only free
text, the binding a per-block context scope (Slice E) resolves into sources.

## What changed

- **`ResourceRef{Kind, ID}`** and `ContextVariable.BoundResource *ResourceRef`.
  A variable binds *either* free-text `BoundContext` *or* a `BoundResource` — the
  two are mutually exclusive. `cloneTemplateInfo` deep-copies the ref (so a clone
  never shares the pointer) and `normalizeTemplateInfo` trims it, nilling an empty
  ref.
- **The `set_context_variable` op carries `BoundResource`** and rides the full
  changeset lifecycle:
  - **validate:** a resource binding requires a non-empty kind + id and rejects a
    simultaneous non-empty `BoundContext`; the op payload's ref is trimmed in
    normalize.
  - **apply:** binds the resource copy-on-write, clearing the free-text binding
    (and vice-versa).
  - **inverse:** restores the exact prior binding — free text *or* resource.
  - **rebase footprint / history:** unchanged — they key off the op type and the
    variable name, not the binding value.
- The JSON is additive (`boundResource` omitempty), so existing documents and
  clients are unaffected.

Consumption — resolving a block's `includes − excludes` over these bindings into a
source allow-set for scoped retrieval — is **Slice E**.

## Verification

- Unit (`core/capability/document`): clone deep-copies `BoundResource`; normalize
  trims/nils it; validate accepts a well-formed resource binding and rejects both
  a dual binding and a malformed ref; apply binds the resource and clears free
  text without mutating the input base (copy-on-write); the inverse round-trips
  back to the prior free text. The whole package passes `go test`.

### Pre-existing data race (out of scope, flagged)

`go test -race ./core/capability/document/` reports a data race — but it is
**pre-existing and unrelated to this slice**. It fires in the concurrent
`SubmitChanges` test, where `normalizeStoredBase` mutates a shared `doc.Base.Rows`
in place while a second goroutine clones the same base (`cloneBase` →
`cloneRows`). Reverting all of Slice D (verified by building the pre-D1 tree with
the new test file removed) still reproduces it 4–6×/run; it involves row/layout
normalization, not context variables. Fixing the document service's concurrent-
base sharing is a separate change and is left out of this slice deliberately.

## Settled

- A context variable can name a resource, not just free text; the binding rides
  the existing `set_context_variable` op through validate/apply/inverse. ✓
- Resource and free-text bindings are mutually exclusive; the ref is deep-copied. ✓
- Additive, backward-compatible JSON. ✓
- Consumption (scope resolution + scoped retrieval + staleness) is Slice E.
