# Block-markdown agent document tools (fast, real editing)

The Action agent's document tools required the model to emit **UTF-8 byte
offsets** for every mark (bold/italic) — the one thing LLMs are worst at. A live
Action run **timed out**: the model burned its tool rounds miscounting offsets and
retrying `append_changes`. Replaced the atom/offset tools with **block-level
markdown** tools; the server does the offset math.

## `core/capability/document/markdown.go` (committed in 0cb8aaf)

`RenderBlockMarkdown` / `ParseBlockMarkdown` convert a block's atoms+marks to and
from an inline-markdown subset (bold, italic, code, strike, link). Parse makes
each styled run its own atom with a whole-atom mark, so no caller computes an
offset. Reused later by BR-EXPORT / BR-FILE-IMPORT.

## `core/capability/agent/document_tools.go`

- **`document.get`** now returns the document as an ordered list of blocks, each
  `{id, kind, markdown}` — no atoms, no offsets.
- **`document.edit`** (was `document.append_changes`) takes block-level ops:
  `append {kind, markdown}`, `insert {afterBlockId, kind, markdown}`,
  `replace {blockId, kind?, markdown}`, `delete {blockId}`.
  `markdownOpsToChangeOps` translates them into the document's low-level change
  operations — each agent block is a one-block row — parsing markdown to
  atoms+marks server-side.

## Why

A live Action run now **reads two documents and appends a correct synthesizing
section to the second in ~6 seconds for ~$0.003** (`dev-test/action/run.sh`) — the
exact class of task that previously timed out. The model never computes a byte
offset; it reads and writes prose as markdown.

## Tests

- **Unit** (`document_tools_test.go`): `markdownOpsToChangeOps` maps
  append/insert/delete to the right change ops and produces a bold mark; rejects
  an unsupported kind and an unknown block id.
- **Scripted** (`workflow_test.go`): the Action lifecycle test now scripts
  markdown ops.
- **Live**: `dev-test/action/run.sh` (read A → synthesize into B, verified) and
  the updated `dev-test/agents/run.sh` story test, both real-provider,
  cost-surfaced, skip-without-key.
