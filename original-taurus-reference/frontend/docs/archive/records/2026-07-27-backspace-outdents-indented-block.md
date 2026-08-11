# 2026-07-27 — Backspace outdents an indented block before merging it up

At the very start of an indented block, Backspace now drops the block's indent one level
(mirroring Tab/Shift-Tab) instead of joining it into the block above — only shedding the
indent, then falling through to the normal join once there is none left.

## An IndentHost + a Backspace command threaded into the keymap

```ts
export interface IndentHost {
  indentOf(blockId: string): number;
  outdentBlock(blockId: string): void;
}

function outdentOnBackspace(host: IndentHost): Command {
  return (state, dispatch) => {
    const { selection } = state;
    if (!selection.empty || selection.$from.parentOffset !== 0) return false;
    const blockId = String(selection.$from.parent.attrs.blockId ?? '');
    if (!blockId || host.indentOf(blockId) <= 0) return false;
    if (dispatch) host.outdentBlock(blockId);
    return true;
  };
}
// plugins(host) inserts keymap({ Backspace: outdentOnBackspace(host) }) before baseKeymap;
// the runtime passes itself as the host (indentOf reads the snapshot, outdentBlock calls setBlockIndent).
```

General block indent is not a ProseMirror attribute — it lives in the runtime's block-style
maps and renders as left padding. So the command reaches back into the runtime through the
narrow `IndentHost` surface (`plugins(this)`) rather than reading the document. It returns
false unless the caret is empty at offset 0 of a block with indent > 0, so normal Backspace
(delete a character, or join a non-indented block) is untouched.

**Why:** an indented paragraph could only be un-indented from the inspector; Backspace at its
start merged it upward, which is surprising. Outdenting first matches how Tab indents.

## Verified against real Omega

New `e2e/document-inspector.spec.ts` drives a real document: it indents a block through the
inspector, puts the caret at the block start, presses Backspace, and asserts the left padding
returns to zero with the text preserved. It also covers the Selected-Text layout (stable
three-line preview box, `Line spacing` `data-min=0`, indent controls, Add comment above the
Characters / Words / Lines facts). Both tests pass; `pnpm check` 0/0, 284 unit tests green.
