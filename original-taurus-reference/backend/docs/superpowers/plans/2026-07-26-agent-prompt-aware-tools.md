# Agent prompt-aware document tools (Slice H) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the AI quarterback see and author prompt blocks: `document.get` reveals a prompt block *as* a prompt (its instruction + context), and new tools let an Action **create** a prompt block, **set** its instruction/context, and **resolve** it — so an agent edit ("split this section into two prompt blocks") yields a still-live document. Every primitive already exists at the changeset layer (Slices E + the existing `insert_block`/`set_prompt`); this slice only exposes them to the agent.

**Architecture:** Extend `document.get`'s block view with prompt fields. Add three Action-only tools — `document.prompt.create`, `document.prompt.update`, `document.prompt.resolve` — each mapping to `insert_block(kind:"prompt")` / `set_prompt` / `set_block_context` (Slice E) submitted via `SubmitChanges`, and (for resolve) enqueuing a `document.resolve` job. Tools are attributed to the task requester, the correct actor for an agent edit.

**Tech Stack:** Go, `core/capability/agent` document tools + `intelligence.ToolBinding`; the changeset ops from Slice E; the job `Enqueuer`.

## Global Constraints

- **Depends on Slice E** (`set_block_context` op + `BlockContext`) and Slice A/E context variables. Order H after E.
- Capabilities never import each other; the agent already composes `document` via its `documents` field and `Authorizer` port.
- Verbatim `*.go.md` companions same commit; multi-section hand-edited; `gofmt` before regen.
- One `docs/records/NNNN-*.md`.
- TDD: failing test first.

---

## File structure

- `core/capability/agent/document_tools.go` (modify) — reveal prompt in `modelKindOf`/`blockView`; add the three prompt tools + their input/output schemas + `markdown→ChangeOp` helpers for prompt ops.
- `core/capability/agent/workflow.go` (modify) — bind the new tools for Action tasks (beside `documentGetTool`/`documentEditTool` at `:189-193`).
- `core/capability/agent/workflow.go` / `WorkflowOptions` (modify) — an optional `Enqueuer` for the resolve tool.
- `core/wiring/wiring.go` (modify) — pass `queue` as the workflows' `Enqueuer`.
- `core/capability/agent/*_test.go` (modify) — tool-level tests.
- `docs/records/NNNN-agent-prompt-tools.md` (create).

---

## Task H1: Reveal prompt blocks in `document.get`

**Files:**
- Modify: `core/capability/agent/document_tools.go`
- Test: `core/capability/agent/document_tools_test.go`

**Interfaces:**
- Produces: `modelKindOf` returns `"prompt"` for a prompt block; `blockView` gains `Instruction string `json:"instruction,omitempty"`` and `Context *contextView `json:"context,omitempty"`` populated for prompt blocks.

- [ ] **Step 1: Failing test:** a document with a prompt block (instruction "Summarize sales", context include `["sales"]`) → `document.get` returns that block with `kind:"prompt"`, `instruction:"Summarize sales"`, `context.include:["sales"]`.
- [ ] **Step 2: Run — FAIL** (prompt reads as "paragraph"; no instruction).
- [ ] **Step 3: Implement**
  - In `modelKindOf` (`document_tools.go:93-107`), add a `document.BlockKindPrompt` case returning `"prompt"`.
  - Extend `blockView` with `Instruction` + `Context`; when building the view in `documentGetTool`, if the block is a prompt block, read `PromptData.Instruction` and the block's `Context` (Slice E) into the view. Update the `document.get` tool Description to list `prompt` as a kind.
- [ ] **Step 4: Run — PASS.**
- [ ] **Step 5: Companion + commit** `git commit -m "Reveal prompt blocks in the agent document.get tool"`

---

## Task H2: `document.prompt.create`

**Files:**
- Modify: `core/capability/agent/document_tools.go`, `core/capability/agent/workflow.go`
- Test: `core/capability/agent/document_tools_test.go`

**Interfaces:**
- Produces tool `document.prompt.create` — input `{documentId, afterBlockId?, instruction, include?[], exclude?[]}` → creates a prompt block after `afterBlockId` (empty = start), sets its instruction and context; output `{documentId, blockId, changeSetId, seq}`.

- [ ] **Step 1: Failing test:** call the tool's handler with an instruction + include list; assert a new prompt block exists (via `documents.Get`) with that instruction and context.
- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement** the tool binding (mirror `documentEditTool`): authorize; `documents.Get`; build ops:
  - `{Op: document.OpInsertBlock, AfterBlock: input.AfterBlockID, Block: &document.Block{ID: newBlockID(), Kind: document.BlockKindPrompt}}`
  - `{Op: document.OpSetPrompt, BlockID: <newID>, SetText: input.Instruction}`
  - if include/exclude present: `{Op: document.OpSetBlockContext, BlockID: <newID>, BlockContext: &document.BlockContext{Include: input.Include, Exclude: input.Exclude}}`
  - submit via `SubmitChanges` with `ExpectedRevision: doc.Revision`, author `task.RequesterID`.
  (Generate the block id with a helper like `newTaskID()`; the id must be referenced by the later ops. Wrap all three ops in one submission so the block, its prompt, and its context land atomically. Confirm `OpInsertBlock`/`OpSetPrompt` field names — `SetText` carries the instruction per `changeset_apply.go:512-531`.)
  - Add `documentPromptCreateInputSchema`/`OutputSchema` and register the tool in `workflow.go` for Action tasks.
- [ ] **Step 4: Run — PASS.**
- [ ] **Step 5: Companion + commit** `git commit -m "Add document.prompt.create agent tool"`

---

## Task H3: `document.prompt.update`

**Files:** same as H2.

**Interfaces:**
- Produces tool `document.prompt.update` — input `{documentId, blockId, instruction?, include?[], exclude?[]}` → sets whichever are provided.

- [ ] **Step 1: Failing test:** update an existing prompt block's instruction and context; assert both changed and (per Slice E) `ResolvedAt` was cleared.
- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement:** authorize; `Get`; build ops conditionally — `OpSetPrompt` (SetText) when instruction present; `OpSetBlockContext` when include/exclude present; reject when the target block is not a prompt block (`invalid_arguments`). Submit atomically. Register for Action tasks.
- [ ] **Step 4: Run — PASS.**
- [ ] **Step 5: Companion + commit** `git commit -m "Add document.prompt.update agent tool"`

---

## Task H4: `document.prompt.resolve`

**Files:**
- Modify: `core/capability/agent/document_tools.go`, `core/capability/agent/workflow.go` (+ `WorkflowOptions.Enqueuer`), `core/wiring/wiring.go`
- Test: `core/capability/agent/document_tools_test.go`

**Interfaces:**
- Consumes: a job `Enqueuer` on `Workflows`.
- Produces tool `document.prompt.resolve` — input `{documentId, blockId, mode?}` → enqueues a `document.resolve` job (default mode `reload`); output `{documentId, blockId, status:"queued"}`. Absent an enqueuer, the tool is not bound.

- [ ] **Step 1: Failing test:** with a fake enqueuer on the workflow, calling the tool enqueues one `document.resolve` job with `{projectId, documentId, blockId, mode:"reload"}`.
- [ ] **Step 2: Run — FAIL.**
- [ ] **Step 3: Implement**
  - Add `Enqueuer job.Enqueuer` to `WorkflowOptions` and store it on `Workflows`.
  - The tool handler authorizes, then `w.enqueuer.Enqueue(ctx, document.JobTypeResolve, map[string]string{projectId, documentId, blockId, mode})`.
  - In `workflow.go` Action tool assembly, bind `document.prompt.resolve` only when `w.enqueuer != nil`.
  - In `wiring.go`, pass `Enqueuer: queue` into `agent.NewWorkflows(...)`.
- [ ] **Step 4: Run — PASS + `go build ./...`.**
- [ ] **Step 5: Companions** (`document_tools.go.md`, `workflow.go.md`, `wiring.go.md` multi-section) + commit `git commit -m "Add document.prompt.resolve agent tool"`

---

## Task H5: dev-test — agent splits a section into live prompt blocks

**Files:**
- Modify: `dev-test/agents/` or the demo suite (Slice I)

- [ ] **Step 1:** (Live, skip-on-no-key.) Seed a document with one prompt block scoped to a connector. Run an Action task instructing the agent to split it into two prompt blocks (e.g. "split the summary into an overview block and a details block, keep the same context, and resolve both"). Assert: two prompt blocks now exist, each with an instruction and the connector context, and each has resolved content (poll the resolve jobs). Assert the original single block is gone.
- [ ] **Step 2:** Run; `track_usage`/`usage_summary`. `go vet ./... && ./dev-test/run.sh`.
- [ ] **Step 3:** Commit `git commit -m "Cover agent prompt-block authoring in dev-test"`

---

## Task H6: Change record

- [ ] Create `docs/records/NNNN-agent-prompt-tools.md`: *why* — the quarterback can now see prompt blocks and author them (create/update/resolve), mapping to existing `insert_block`/`set_prompt`/`set_block_context` primitives; no new low-level document primitive; agent edits are attributed to the task requester, resolution rides the async job. Satisfies acceptance criterion 6.
- [ ] Companion-drift check.
- [ ] Commit `git commit -m "Record NNNN: agent prompt-aware tools"`

---

## Self-review

- **Spec coverage:** implements "Agent gains prompt-aware document tools." Satisfies acceptance criterion 6 (agent splits a section into two resolved prompt blocks). Prompt-aware `split_block` remains unneeded — the agent composes delete + create.
- **Type consistency:** the three tools submit `document.ChangeOp`s (`OpInsertBlock`/`OpSetPrompt`/`OpSetBlockContext`) via `SubmitChanges`, matching the existing `documentEditTool` flow; the resolve tool enqueues the exact `document.resolve` payload used by transport and the Slice G cascade.
- **Dependency:** requires Slice E's `set_block_context` op + `BlockContext`; sequenced after E.
- **No placeholders:** real op construction; the `OpInsertBlock`/`OpSetPrompt` field names (`SetText`, `Block`) and schema-var names must match the package — flagged where they must be confirmed against source.
- **Boundary check:** stays within the agent capability's existing composition over `documents` + the `Enqueuer` port; no new cross-capability import. ✓
