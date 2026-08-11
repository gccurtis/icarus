# 0011 — the prompt block

A new document block kind whose text is **generated** — grounded by
[knowledge](../../core/capability/knowledge/) retrieval and produced through
[intelligence](../../core/capability/intelligence/) — rather than authored. It
is the first payoff of a fully working knowledge lattice: a document can now
contain a block that answers a prompt from the project's own sources, with the
evidence attached.

This record covers the design decisions and the increments that build it.

## What it does

- The author writes a **prompt** (an instruction) into a prompt block.
- Resolving it runs: **plan** (a reasoning model turns the prompt into retrieval
  queries) → **retrieve** (against the knowledge lattice) → **synthesize** (a
  structured-output model call produces the display text, or a stable
  *insufficient* / *contradiction* answer when the evidence doesn't support one).
- The result is written into the block as **ordinary display text** — atoms and
  marks — so it renders, is markable, and is directly editable like any block.
- The block also carries the **evidence** (the supporting source spans, by id)
  and the resolution **status**.
- **Refresh** re-resolves only if something changed (a source it used, or the
  prompt); **reload** always re-resolves. Both feed the current text back in as
  the prior value so re-generations stay stable.

## Design decisions

### Composition, not a Block interface

A prompt block needs kind-specific data the current uniform `Block` never had.
Rather than turn `Block` into a Go interface (a large refactor of stable code —
every field access becomes a method, custom JSON everywhere), `Block` stays the
**shared base** and gains a typed, per-kind `Data BlockData` — the "subtype." A
plain paragraph or heading has no `Data`; a prompt block carries `PromptData`.
`Block.UnmarshalJSON` selects the concrete subtype from the block's `Kind`
(marshaling needs no custom method — the interface's concrete value encodes
directly, and a nil `Data` is omitted). Everything stays strongly typed, and all
existing block code and storage are untouched.

### Resolution lives in `document`, behind ports

The resolution pipeline is inference-bearing, but that does **not** force a new
capability: `document` defines **ports** and lets the composition root supply the
adapters — exactly how `knowledge` depends on an `Embedder` it never imports.
Document gains a `PromptModel` port (structured plan + synthesize) and a
`Retriever` port (over `knowledge.Retrieve`); wiring satisfies both. So the
prompt block stays a document concern, `document` still imports neither
`intelligence` nor `knowledge`, and there is no new capability — the lean choice.

### Generated content is `Inferred` and stays out of the lattice

Every block gains an `Inferred` flag on the shared base. A prompt block's content
is generated, so it is marked inferred, and the text a document feeds to the
knowledge lattice (`flatten`) **excludes inferred blocks**. Otherwise the lattice
would index its own output — a feedback loop. Only authored source text is
indexed.

### Casts are configured

Which models plan and synthesize is a configuration choice (`documents.prompt`
casts), resolved through the intelligence cast tables — so retargeting the models,
or making synthesis reasoning vs. inference, is a config edit, not a code change.

## Increment 1 — the block model (landed)

- `Block` gained `Inferred bool` and `Data BlockData` on the shared base;
  `BlockData` is the typed-subtype interface, with `PromptData` its first
  implementation (`Instruction`, `Status`, `Evidence []EvidenceSpan`,
  `Sources []SourceVersion`, `LastOutput`, `ResolvedAt`).
- `BlockKindPrompt` was added to the block-kind registry (it fails closed like
  the rest); `Block.UnmarshalJSON` decodes `Data` into the subtype the kind
  implies; `normalizeBlock` marks a prompt block `Inferred` and defaults its
  `Data`; `cloneBlock` deep-copies the new fields; and `validBlockData` enforces
  that `Data` matches `Kind` (prompt blocks carry `PromptData`, others none).
- The knowledge handler's `flatten` skips inferred blocks.
- Tests cover the JSON round-trip (the subtype survives marshal→unmarshal and
  storage), prompt-block normalization (inferred, defaulted data), and that
  `flatten` excludes inferred blocks.

## Increment 2 — the change-set ops (landed)

Two ops extend the change-set engine for prompt blocks: `set_prompt` (a client
authors/edits the instruction; it also clears the resolution's `ResolvedAt` so a
later refresh re-resolves) and `resolve_block` (the pipeline incorporates a
resolution — replacing the block's display atoms and setting its `PromptData`,
keeping it inferred). Both refuse non-prompt blocks (`ErrConflict`).

## Increments 3–4 — the resolution pipeline (landed)

`Documents.ResolveBlock(projectID, docID, blockID, mode)` runs the pipeline, in
[`prompt.go`](../../core/capability/document/prompt.go):

1. **Plan** — the instruction → retrieval queries, a structured `PromptModel`
   call under the configured plan cast.
2. **Retrieve** — each query through the `Retriever` port (over
   `knowledge.Retrieve`), pooled and deduplicated into evidence spans.
3. **Synthesize** — instruction + current text + evidence → a structured
   `{status, response}`, under the synthesis cast. An unknown/missing status
   fails closed to `insufficient` — never an ungrounded answer presented as ok.
4. **Incorporate** — the response becomes the block's atoms and the `PromptData`
   (status, evidence, source origins, last output, resolved-at) is set, folded
   in as a system-authored `resolve_block` change set.

Both ports live on the `document` capability; the composition root supplies the
adapters (`documentPromptModel` over `intelligence.ReasonJSON`, `documentRetriever`
over the knowledge lattice) and the casts, so `document` imports neither. The
resolve mode's casts and retrieval bounds are configured under
`documents.prompt`. Usage from every model and retrieval call is summed and
returned, so the cost of a resolution is surfaced.

Resolution is **inference-heavy, so it runs as a background job**
(`JobTypeResolve`), triggered by `POST /dev/documents/:id/blocks/:blockID/resolve`
(202 + a job id to poll), mirroring re-base.

**Refresh vs. reload vs. auto.** *Reload* always runs. *Refresh* runs only if
something changed — a prompt edit (which zeroed `ResolvedAt`) or the project's
knowledge changing since the last resolve, detected by a cheap
`knowledge.ChangedSince` (project-granular; no retrieval, no model call). When
nothing changed, refresh is a no-op (`skipped`), and the current text — including
any manual edits — stays. *Auto* (the empty mode) is a reload the first time (no
text yet), a refresh after. Both refresh and reload feed the **current display
text** into the synthesis prompt as the prior value, so a re-generation stays
close to what was there unless the answer genuinely changed.

## Increment 5 — live, verified, and hardened

A live suite ([`dev-test/prompt`](../../dev-test/prompt/run.sh)) runs the whole
journey against real models (`gpt-4o-mini` for plan + synthesize,
`text-embedding-3-small` for retrieval), skipping without a key:

- **Grounding + propagation** — index a source ("the Eiffel Tower is 300 meters
  tall"), resolve a prompt block against it (`status: ok`, evidence citing the
  source, the answer says 300), then edit the source (→ 450), re-index it, and
  **refresh** the block — the change propagates and the answer becomes 450.
- **Insufficient** — a prompt with no supporting evidence resolves to
  `insufficient`, not a guess.
- **Contradiction** — a prompt over two sources that disagree (450 vs. 900)
  resolves to `contradiction`, not a fabricated single number.

Every resolution records its `Usage` on the block (it runs in a job, so this is
where the cost is visible); the suite sums it and reports an estimate.

Two fixes the live path surfaced — the reason this is only worth testing against
real intelligence:

1. **Strict schemas.** The OpenRouter adapter requests `json_schema` with
   `strict: true`, which requires `additionalProperties: false`; the plan and
   synthesis schemas were tightened.
2. **Prior draft is not evidence.** Feeding the current text into synthesis for
   wording stability made a small model treat that *prior draft* as a competing
   fact — on the propagation step it falsely flagged a `contradiction` between
   the 300-meter draft and the 450-meter source. The synthesis prompt now scopes
   contradiction to **evidence-vs-evidence only** and labels the prior text an
   explicitly stale "Previous draft (not evidence)". A genuine evidence conflict
   still yields `contradiction`; a propagated change now yields the updated
   answer.

The paired [`manual.md`](../../dev-test/prompt/manual.md) walks it by hand; the
[backend guide](../backend-guide.md) and the
[architecture doc](../architecture/capabilities/documents/prompt-blocks.md)
document the feature.

## Increment 6 — prompts in config, refined, and cost-visible tests

Three follow-ons:

- **Prompts moved to configuration.** The plan and synthesis prompts are now Go
  `text/template`s, overridable under `documents.prompt.plan` /
  `documents.prompt.synthesis` (blank fields, and any that fail to parse, fall
  back to the built-in defaults). So the prompts can be tuned without a code
  change. The full templates and their placeholders are documented in the new
  [prompt resolution workflow](../architecture/workflows/prompt-resolution.md).
- **Synthesis prompt refined (again).** Beyond scoping contradiction to
  evidence-vs-evidence, the block now feeds both the **previous prompt** and the
  **previous response** into synthesis — the previous response as a
  formatting reference only, and the previous prompt so the model can tell
  whether the *formatting intent* changed. `PromptData` gained `LastInstruction`
  to carry the former.
- **Tests split by cost.** `dev-test/run.sh` now takes `free` /
  `intelligence` / `all`: the offline suites run at no cost, the model-backed
  ones (`intelligence`, `knowledge`, `prompt`) each report their own estimated
  cost, and the runner prints the total across them. So a run only spends money
  when you ask for the intelligence group, and the spend is always visible.

## Complete

The prompt block is real: authored prompt → planned retrieval → grounded
synthesis → editable text, with reload / refresh / auto, evidence, and stable
non-answers. Prompts live in configuration and are documented in full. Delivered
as committed increments, each build/vet/test + verbatim-doc + fake-model unit
tests green, and the whole loop — grounding, propagation, insufficient, and
contradiction — proven live against real models, with the cost surfaced.

## Scope boundary

No cross-document prompts, no automatic resolution on document read (resolution
is triggered explicitly, per block), and none of the reference's
generation/verify/promote/subscription machinery — the same lean line drawn for
knowledge.
