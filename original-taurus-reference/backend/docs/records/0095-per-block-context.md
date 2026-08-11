# Per-block context selection (live-document Slice E)

The fifth slice of the live-document program (design:
[`docs/superpowers/specs/2026-07-26-live-document-connectors-design.md`](../superpowers/specs/2026-07-26-live-document-connectors-design.md);
plan: [`docs/superpowers/plans/2026-07-26-per-block-context-selection.md`](../superpowers/plans/2026-07-26-per-block-context-selection.md)).
It gives each prompt block its own retrieval scope and makes resolution honor it.
Builds on resource-backed context variables (Slice D, record 0091) and
source-scoped retrieval (Slice C, record 0090).

## What changed

- **`Block.Context *BlockContext {Include, Exclude []string}`** — a block's
  per-block selection over the document's declared context variables. Deep-cloned
  in the block clone path so a cloned block never shares its selection.
- **`resolveBlockScope(template, ctx) []ScopeOrigin`** — computes the scope as
  **includes − excludes** over the variables' bound-resource origins (dedup,
  include order). Unbound or undeclared variables contribute nothing, so an
  in-progress selection never errors — it just widens or narrows the scope.
- **The `set_block_context` op** rides the full changeset lifecycle:
  - **validate:** block id present; the selection (if any) has no blank names and
    no name in both include and exclude. Block *existence* is enforced at apply
    (`ErrConflict`), matching `assign_block_style`/`set_prompt`.
  - **apply:** sets `Context` copy-on-write; for a prompt block, clears
    `PromptData.ResolvedAt` so a refresh re-resolves (the old output stays visible
    until then).
  - **inverse:** restores the prior `Context` and, for a prompt block, the prior
    `ResolvedAt` (via a `resolve_block`, mirroring `set_prompt`'s inverse).
  - **rebase footprint:** block-scoped (`block-context` + `block-data`), so it
    rebases disjointly against edits to other blocks.
  - **history:** `op.BlockID` is recorded generically — no special case needed.
- **Scoped resolution:** the `Retriever` port gains
  `RetrieveScoped(..., allow []ScopeOrigin)`. `ResolveBlock` retrieves scoped when
  the block's selection resolves to a non-empty scope, else keeps whole-project
  retrieval. The wiring adapter maps `document.ScopeOrigin{Kind,ID}` 1:1 to
  `knowledge.Origin` and calls `RetrieveScopedMany` — so `document` imports no
  knowledge types; the kind→sourceType mapping lives in wiring.

## Verification

- Unit (`core/capability/document`): `cloneBlockContext` is deep;
  `resolveBlockScope` computes includes − excludes and skips unbound/undeclared
  names; `set_block_context` validates, applies (context set, ResolvedAt cleared,
  input base untouched), inverts (prior context + prior ResolvedAt restored), and
  conflicts on an unknown block; `ResolveBlock` uses `RetrieveScoped` with the
  right allow-set when the block has context and falls back to whole-project
  otherwise. Full package `-race` clean; companions at zero drift.
- Live dev-test (`dev-test/context-scope`, skips without a key): swapping a
  block's bound variable flips which source's content appears; the swap clears
  ResolvedAt; an include-both-minus-one case proves exclude removes a source.

## Settled

- Each prompt block declares its own `include`/`exclude`; scope =
  `includes − excludes` resolved to source origins. ✓
- Resolution retrieves scoped (Slice C) when a selection is set, whole-project
  otherwise. ✓
- Changing a block's selection clears its `ResolvedAt` (acceptance criterion 4);
  exact scoping including exclude (criterion 5). ✓
- **Cross-block** staleness — re-resolving *other* blocks when a shared variable
  is rebound or a bound connector syncs — is driven by the reference graph
  (Slices F/G), not this slice.
