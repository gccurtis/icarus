# PromptControls.svelte

The AI prompt block's section in the Block lens: instruction, Resolve, grounding status, last
output, and evidence.

## The instruction is a draft

```ts
let promptDraft = $state('');
let promptFor = $state('');
$effect(() => {
  const instruction = $editorSession?.blockPrompts[blockId]?.instruction ?? '';
  const key = `${blockId}:${instruction}`;
  if (key !== promptFor) { promptFor = key; promptDraft = instruction; }
});
```

The textarea binds to local state and commits on `change`, so an in-progress instruction
survives the session updates that arrive on every keystroke elsewhere. The key includes the
server instruction as well as the block id, so the draft re-seeds after a resolve or a reload
rewrites it — not only when the user selects a different block.

## Status is a claim about grounding

```ts
const promptStatusTone = { ok: 'success', insufficient: 'attention', contradiction: 'danger' };
const promptStatusLabel = { ok: 'Grounded', insufficient: 'Insufficient evidence', contradiction: 'Contradiction' };
```

The badge reports whether Omega could ground the block's output in the project's sources.
`ok` is rendered as *Grounded* rather than "OK" because the useful statement is about evidence,
not about the request succeeding — a resolve can succeed and still be unsupported.

## Resolve guards on both sides

```svelte
disabled={$editorSession?.resolving || !promptDraft.trim()}
```

Disabled while a resolve is already running (the runtime polls one job at a time) and while the
instruction is blank. The label doubles as the progress indicator, so the button is the whole
status surface for the operation.

Evidence and last output render only when present — a prompt block that has never resolved
shows just the instruction and the button.
