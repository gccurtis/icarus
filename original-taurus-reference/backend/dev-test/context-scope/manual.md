# Manual test: per-block context selection

This is the by-hand version of [`run.sh`](run.sh). A prompt block can carry its
own **context selection** over the document's declared context variables: an
`include` set and an `exclude` set of variable names. At resolution the block's
scope is computed as **includes − excludes**, resolved to the concrete source
origins those variables are bound to, and retrieval is restricted to exactly
those sources. A block with no selection retrieves across the whole project, as
before.

Changing a block's selection is the `set_block_context` op. It sets the block's
`context` and, for a prompt block, clears its `resolvedAt` so the next refresh
re-resolves under the new scope (the old output stays visible until then).

## Why this suite needs a real key

Scoped retrieval + generation only mean anything against real models. Without a
key the automated [`run.sh`](run.sh) **skips**.

## What it exercises

Scope resolution is **kind-agnostic**: a context variable's `ResourceRef.Kind`
maps 1:1 to a knowledge `sourceType`. The suite proves this on both source kinds:

- **Part 1 — documents:** two variables bound to two indexed **documents**.
- **Part 2 — connectors:** two variables bound to two live **connector**
  resources, each synced from its own external `connector-watcher` over a temp
  folder. This is the real live-data target; it takes the identical
  `resolveBlockScope → RetrieveScoped` path as Part 1.

Two sources carry invented identifiers that appear nowhere else — **Zephyrite**
(solar) and **Borealis** (wind) — so the model can only name one if that source
was actually in scope. In each part the suite:

1. Scopes the block to the `solar` variable and resolves → the answer names
   **Zephyrite**, never **Borealis**.
2. Swaps the scope to the `wind` variable → asserts the op **cleared
   `resolvedAt`**, then refresh flips the answer to **Borealis**, never
   **Zephyrite** (acceptance: a selection change changes the output).
3. (Part 1) Includes **both** variables but **excludes** `wind` → the answer
   names **Zephyrite** and never **Borealis** (acceptance: exact scoping,
   including exclude).

Assertions target scope **membership** — which source's identifier appears — not
exact wording, because the model's phrasing varies.

## By hand

Sign in, create and select a project, then create two source documents (one
mentioning "Zephyrite", one "Borealis") and index each with
`POST /dev/knowledge/documents/:id`. Create a report document with a prompt
block, declare two variables with `set_template`, and bind each to one source
with `set_context_variable` (`boundResource: {kind:"document", id:...}`). Then
drive the three steps above with `set_block_context` ops
(`{"op":"set_block_context","blockId":"pb","blockContext":{"include":[...],"exclude":[...]}}`),
resolving via `POST /documents/:id/blocks/:block/resolve` and polling the job.
Read the answer back from the block's `data.lastOutput`.

Cross-block staleness — re-resolving *other* blocks when a shared variable is
rebound or a bound connector syncs — is driven by the reference graph
(Slices F/G), not this suite; here each step re-resolves the one block whose own
selection changed.
