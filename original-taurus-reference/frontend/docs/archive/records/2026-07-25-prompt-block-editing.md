# Prompt-block editing section (B1)

Re-add the inspector's AI-prompt section — edit a prompt block's instruction, resolve it, and see
its status / evidence / last output. Omega + the runtime already supported this; only the UI + the
session surface were missing.

## Omega / runtime (already present)

`set_prompt` (instruction) + `resolve_block` ops; `POST /documents/:id/blocks/:blockID/resolve`
(async job). The runtime already exposes `setPrompt` (pushes `set_prompt`, flushes) and
`resolvePrompt` (enqueue → poll job → reload) + a `resolving` flag. `block.data` holds `PromptData`
(instruction / status / evidence / lastOutput / resolvedAt).

## Changes

- `session.ts` — added `blockPrompts: Record<string, PromptData>` to the session (the `resolving`
  flag already existed).
- `runtime.ts` — `updateSession` now collects each prompt block's `data` (from the snapshot) into
  `blockPrompts`.
- `DetailsPanel.svelte` — for a selected **prompt** block, a new section: an instruction `Textarea`
  (seeded from the block, committed via `setPrompt` on change), a **Resolve** button
  (`resolvePrompt`, disabled while resolving), a status badge (Grounded / Insufficient / Contradiction),
  the last output, and the evidence list.
- `Textarea` already spreads `...rest`, so `onchange` passes through natively (commit on blur).

## Verification

- `:8444`: `set_prompt {blockId, setText}` → `201`; persists at `block.data.instruction`. (Resolve
  executes via the async job + AI engine — verify on the engine-enabled `:8443`.)
- `svelte-check` clean; vitest 227/227; touched companions reproduce.
