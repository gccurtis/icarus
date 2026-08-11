# Document `ScopeResolver` port: expand bound contexts before retrieval (`core/capability/document`)

Design: [`docs/superpowers/specs/2026-07-27-context-capability-design.md`](../superpowers/specs/2026-07-27-context-capability-design.md).
Adds the document-side half of the `document.ScopeResolver` port the spec
describes, and wires `ResolveBlock` to call it: a prompt block's include/exclude
variable selection is now expanded to concrete leaf origins — through the
`contexts` capability, once wired — before it is handed to `RetrieveScoped`,
instead of being subtracted at the raw origin level only.

## What changed

### `core/capability/document/prompt.go`

- **`ScopeResolver` port**, added right after `PersonaResolver`:

  ```go
  type ScopeResolver interface {
  	ExpandScope(ctx context.Context, projectID string, include, exclude []ScopeOrigin) ([]ScopeOrigin, error)
  }
  ```

  It receives the block's included and excluded origins as an *anonymous
  context definition* — unsubtracted — and returns the flattened,
  leaf-level `include − exclude`: a `context`-kind origin expands (nested
  contexts, `whole-project`), and any other kind passes through unchanged.
  Satisfied over the `contexts` capability at composition (Task 7); when nil,
  document falls back to its own origin-level subtraction, unchanged from
  before this task.

- **`ResolveBlock`'s retrieval-scope step** now goes through the port when one
  is configured:

  ```go
  var evidence []EvidenceSpan
  inc, exc := resolveBlockScopeSelection(doc.Base.Template, blk.Context)
  allow := subtractOrigins(inc, exc)
  if d.scopeResolver != nil && (len(inc) > 0 || len(exc) > 0) {
  	allow, err = d.scopeResolver.ExpandScope(ctx, projectID, inc, exc)
  	if err != nil {
  		return ResolveResult{}, err
  	}
  }
  if len(allow) > 0 {
  	evidence, u, err = d.retriever.RetrieveScoped(ctx, projectID, queries, d.promptTopK, allow)
  } else {
  	evidence, u, err = d.retriever.Retrieve(ctx, projectID, queries, d.promptTopK)
  }
  ```

  `resolveBlockScopeSelection` (Task 5) maps the block's declared variable
  names to their bound-resource origins without subtracting; `subtractOrigins`
  is still computed first as the origin-level fallback `allow`, so a nil
  resolver (or a block with no context selection at all) behaves exactly as
  before. Only when a resolver is configured *and* the block actually declared
  a selection does `allow` get overwritten with the resolver's expanded leaves
  — a context-bound variable is no longer passed straight to `RetrieveScoped`
  as a single opaque origin; it is expanded into the leaves it actually
  represents first.

### `core/capability/document/service.go`

- `Documents` gains a `scopeResolver ScopeResolver` field (nil by default —
  no `Options` field for it).
- **Setter, not an `Options` field:**

  ```go
  func (d *Documents) UseScopeResolver(r ScopeResolver) { d.scopeResolver = r }
  ```

  `docs` is constructed before `contexts` in the composition root's wiring
  order (`contexts` will itself later depend on things built after `document`
  in some deployments, and in general the port's satisfier is built *after*
  the port's consumer). A setter called post-construction avoids an
  Options-time chicken-and-egg between the two capabilities, mirroring
  `connector.UseCascader` (`core/capability/connector/connector.go`), which
  solves the identical ordering problem for the connector/cascade port pair.

## Interfaces added

- `document.ScopeResolver` — `ExpandScope(ctx, projectID string, include, exclude []ScopeOrigin) ([]ScopeOrigin, error)`.
- `(*Documents).UseScopeResolver(r ScopeResolver)`.

## Test

`core/capability/document/prompt_test.go`:

- `fakeRetriever` gained `gotAllow []document.ScopeOrigin`, recorded inside
  `RetrieveScoped`, so a test can assert exactly which allow-set reached
  retrieval.
- `fakeScope` is a fake `ScopeResolver`: it records the `include`/`exclude` it
  was asked to expand and always returns two canned leaf documents
  (`{document, leaf1}`, `{document, leaf2}`).
- `seedPromptDocWithContextVar` builds a document with a template variable
  `all` bound to `{context, C}` and a prompt block with
  `Context: &BlockContext{Include: ["all"]}` — modeled on
  `dependencies_test.go`'s `seedScopedPromptDoc`.
- `TestResolveBlockExpandsBoundContext` wires `docs.UseScopeResolver(scope)`,
  resolves the block, and asserts both ends of the plumbing: `ExpandScope` was
  called with `include = [{context, C}]` (the raw, unsubtracted selection —
  proving `ResolveBlock` hands the port the anonymous definition, not an
  already-subtracted scope), and `RetrieveScoped` received the *expanded*
  `[{document, leaf1}, {document, leaf2}]`, not the raw context origin.

Per the working agreement, this is a plumbing test — a fake `ScopeResolver`
alongside the existing `fakeModel`/`fakeRetriever` is correct here because it
proves wiring (does `ResolveBlock` pass the expanded allow-set through?), not
model quality. `fakeModel` is never stubbed to assert anything about answer
quality; that is validated only by real-provider dev-tests (Task 8).

All pre-existing `prompt_test.go`/`dependencies_test.go` tests continue to
pass unmodified: with no resolver configured (the default from `New`), `allow`
stays the origin-level `subtractOrigins` result exactly as `resolveBlockScope`
computed it before this task, so the nil-resolver path is behaviorally
identical to what shipped before.

## Documented future work (not addressed here)

Carried over from the design spec's "out of scope" section, since this task's
`ScopeResolver` plumbing is a piece of that larger design and does not close
either gap:

1. **Deep cascade.** `DependentPrompts` (`core/capability/document/dependencies.go`)
   still matches a changed source against a prompt block's *directly*
   referenced origins via `resolveBlockScope`; it does not walk into a
   referenced context's own membership. A change to a resource that lives only
   *inside* a context a block includes — not named directly on the block — does
   not yet mark that block's prompts as dependents needing refresh. Closing
   this requires teaching the dependency graph to expand contexts the same way
   `ScopeResolver` now expands them for retrieval.
2. **Connectors as context-like.** A connector's underlying files are not yet
   first-class catalog resources, so a connector cannot itself be expanded
   into leaves the way a context is. Connectors and contexts are structurally
   the same shape (a named thing that represents a set of other things); until
   connector files register as resources, a connector origin in a block's
   selection stays an opaque leaf rather than something `ExpandScope` can
   unfold further.

## Wiring (`core/wiring`)

Composition-root task: constructs the `contexts` capability and wires it into
`document` and `transport`, via two thin adapters — neither `contexts` nor
`document`/`resource` imports the other.

- **`core/wiring/context_catalog.go`** — `resourceCatalog{resources
  *resource.Resources}` implements `contexts.Catalog.AllResources`: pages
  through `resources.List(projectID, PageRequest{Limit: 200})`, following
  `NextCursor`, projecting each `resource.Summary` to a `contexts.Ref` and
  skipping context-kind resources (whole-project is content, not
  organization). Backs whole-project expansion.
- **`core/wiring/document_scope.go`** — `documentScopeResolver{contexts
  *contexts.Contexts}` implements `document.ScopeResolver.ExpandScope`:
  builds an anonymous `contexts.Definition` from the block's include/exclude
  origins, calls `Resolve`, and maps the flattened `[]contexts.Ref` leaves
  back to `[]document.ScopeOrigin`. Backs per-block scope expansion.
- **`core/wiring/wiring.go`** — construction order, after `resources` is
  built and before `transport.New`:

  ```go
  contextsSvc := contexts.New(store)
  contextsSvc.UseCatalog(resourceCatalog{resources: resources})
  docs.UseScopeResolver(documentScopeResolver{contexts: contextsSvc})
  ```

  `contexts.New(store)` reuses the one durable SQLite store that backs every
  other capability, so stored contexts persist across restarts exactly like
  documents, resources, and connectors. `contextsSvc` is then passed as
  `Contexts:` in the `transport.Options{...}` literal, activating the
  `/contexts` HTTP routes (Task 4).

No behavior changes for existing documents: a document with no context-bound
variables never calls `ExpandScope`, so this task adds no new code path for
them — only wires the one prompt blocks with context-bound variables now take
(Task 6's plumbing test already covers that path with a fake resolver; this
task supplies the real one).

## Verification

`dev-test/context-binding/run.sh` is the one live test in this increment — the
only test allowed to judge model-backed retrieval quality (never-stub-the-model).
It proves the whole chain for real, against a real model: a template variable
bound to `{"kind":"context", ...}`, expanded through the real `contexts`
capability (not a fake `ScopeResolver`), scoping real embedding retrieval and a
real reasoning-model answer.

Two source documents carry mutually exclusive invented facts so the model can
only ground an answer in one if that document was actually in retrieval scope:

- Doc A: "The Meridian tower is 512 meters tall."
- Doc B: "The Solace bridge spans 1400 meters."

The suite: creates both, indexes them into the knowledge lattice; creates a
context that includes only doc A and asserts `/contexts/:id/resolved` returns
doc A's origin and not doc B's (pure resolution, no model call yet); binds a
document template variable to that context and scopes a prompt block to it;
resolves the block and asserts the answer contains "512" and omits "1400";
`PATCH`es the context to add doc B, re-asserts `/resolved` now carries both
origins; changes the block's instruction to a doc-B question and re-resolves
(`reload`, bypassing the refresh gate since the block's own selection never
changed — only the context's membership did); asserts the new answer contains
"1400". The last step is the crux: nothing on the block or its bound variable
changed, only the stored context's `includes` — proving the context, not the
block, drives scope.

Run against a live OpenRouter key in `etc/config.local.yaml` (same
`openai/gpt-4o-mini` reasoning / `openai/text-embedding-3-small` embedding
casts the sibling `context-scope`/`prompt` suites use):

```text
✓ core ready
✓ status 201/200 through sign-in, project, both source documents + indexing
✓ status 201 — context created (doc A only)
✓ body contains "id":"<docA>"  /  ✓ body omits "id":"<docB>"      (resolved, pre-model)
✓ status 201 — template variable bound to the context, block scoped to it
✓ status 200 — resolve done; answer has: 512; answer omits: 1400
✓ status 200 — PATCH context to add doc B
✓ body contains "id":"<docA>"  /  ✓ body contains "id":"<docB>"  (resolved, both now present)
✓ status 200 — re-resolve (reload) on a doc-B question; answer has: 1400
✓ all checks passed
```

Observed cost: **1,626 total tokens (1,536 prompt), ≈ $0.000325** at the
suite's $0.20/1M-token estimate — two tiny resolutions (one grounded in doc A
alone, one in both docs) plus the embedding calls to index the two one-sentence
source documents. Registered in `dev-test/run.sh`'s `intelligence_suites` list,
so it runs with the intelligence group and skips cleanly (exit 0) without a key.
