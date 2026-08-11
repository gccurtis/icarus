# Agent prompt-aware document tools (live-document Slice H)

The eighth slice of the live-document program (design:
[`docs/superpowers/specs/2026-07-26-live-document-connectors-design.md`](../superpowers/specs/2026-07-26-live-document-connectors-design.md);
plan: [`docs/superpowers/plans/2026-07-26-agent-prompt-aware-tools.md`](../superpowers/plans/2026-07-26-agent-prompt-aware-tools.md)).
The AI quarterback can now see and author prompt blocks, so an agent edit yields
a still-live document.

## What changed

- **`document.get` reveals prompts.** `modelKindOf` returns `"prompt"` for a
  prompt block, and the block view gains `instruction` and `context`
  ({include, exclude} of context-variable names) — the agent reads a prompt *as*
  a prompt, not just its rendered output.
- **Three Action-only tools** (bound beside `document.get`/`document.edit`):
  - **`document.prompt.create`** `{documentId, afterBlockId?, instruction, include?, exclude?}`
    — inserts a prompt block (its own row), sets its instruction, and (when given)
    its context, in one atomic submission.
  - **`document.prompt.update`** `{documentId, blockId, instruction?, include?, exclude?}`
    — sets whichever are provided; rejects a non-prompt target.
  - **`document.prompt.resolve`** `{documentId, blockId, mode?}` — enqueues a
    `document.resolve` job (default `reload`). Bound only when an `Enqueuer` is
    configured (`WorkflowOptions.Enqueuer`, wired to the job queue).

## No new low-level primitive

Every tool maps to existing changeset ops — `insert_row(prompt block)` +
`set_prompt` + `set_block_context` (Slice E) — submitted through `SubmitChanges`,
exactly like `document.edit`. The resolve tool enqueues the same
`document.resolve` payload the transport route and the Slice G cascade use. So an
agent splitting a section into two prompt blocks (delete + create ×2 + resolve)
composes from primitives that already exist; this slice only exposes them.

## Attribution

Agent edits are authored by the **task requester** (`task.RequesterID`), the
correct actor for an agent's change, and ride the normal changeset pipeline
(Activity-logged). Resolution runs as the async job, so the tool returns
`queued` and the block updates when the job finishes.

## Verification

- Unit (`core/capability/agent`, deterministic — the tool handlers call
  Get/SubmitChanges/Enqueue, no model): `document.get` reports a prompt block's
  kind, instruction, and context; `create` inserts a prompt block with the given
  instruction + context; `update` changes them and rejects a non-prompt block;
  `resolve` enqueues one `document.resolve` reload job with the right payload.
- End-to-end (an Action task actually splitting a section into two resolved
  prompt blocks) is a live, model-backed flow, exercised in the end-to-end demo
  (Slice I), not with a stubbed model.

## Settled

- The quarterback can see prompt blocks and create/update/resolve them. ✓
- No new document primitive — the tools compose Slice E ops. ✓
- Agent edits attributed to the requester; resolution rides the async job. ✓
