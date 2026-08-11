# IndentControl.svelte

Stepper for a block's general indent level (0–16), mapping to Omega's `set_block_indent`.

## Reading the current level

```ts
const currentIndent = $derived($editorSession?.blockAligns[blockIds[0] ?? '']?.indent ?? 0);
```

`blockAligns` carries server truth merged with optimistic pending edits, so the number updates
the moment a step is taken rather than after the next flush. The level is read from the first
target: like line spacing there is no mixed-value state, and stepping makes the selection
uniform.

## Stepping is relative, writing is absolute

```ts
function setIndent(delta: number) {
  const next = Math.max(0, Math.min(16, currentIndent + delta));
  if (blockIds.length) $editorSession?.actions.setBlockIndent(blockIds, next);
}
```

The buttons express a delta but the action takes an absolute level, so the clamp happens once,
here, before the write. The buttons are also disabled at the bounds — the clamp is the
correctness guarantee and the `disabled` state is the affordance; neither alone is enough
(a disabled button is still reachable from a stale render).

Guarding on `blockIds.length` keeps a lens with no server-known blocks from emitting a no-op
op. Every lens that renders this control names its own targets, which for a text run means the
run's `blockIds` — a run indents the blocks it spans.

Backspace at the start of an indented block also outdents it, in the editor rather than here
(see `runtime.ts`, `outdentOnBackspace`); this control and that keybinding write the same
property.
