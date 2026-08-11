# src/lib/features/stages/document/editor/list-commands.ts — breakdown

Companion to [list-commands.ts](list-commands.ts). Two ProseMirror keymap commands
for the flat `list` node: `enterList` (split an item, or leave the list on an empty
item) and `indentList` (change an item's nesting level). Both no-op outside a list
so the base keymap still handles those keys.

## Imports and the list-keymap contract

### ProseMirror `TextSelection`/`Command`, the schema, and the module doc-comment

```ts
import { TextSelection, type Command } from 'prosemirror-state';
import { schema } from './schema';

/**
 * Keymap commands for the flat `list` node (items carry a `level` attr rather than
 * nesting). Each returns false outside a list so the base keymap still runs.
 */

```

The commands need `TextSelection` to reposition the caret and the `Command` type
for their signatures, plus the shared `schema` to test node types against
`list`/`list_item`. The doc-comment states the model — lists are flat, with nesting
expressed as a `level` attr rather than nested nodes — and the convention that
every command returns `false` when the cursor isn't in a list, so ProseMirror's
base keymap keeps handling Enter/Tab elsewhere.

## `enterList` — split the current item, or exit an empty one

### Enter inside a list: leave into a paragraph when empty, else split into a new item

```ts
/** Enter: split the current item into a new one; on an empty item, leave the list. */
export const enterList: Command = (state, dispatch) => {
  const { $from, empty } = state.selection;
  if (!empty || $from.parent.type !== schema.nodes.list_item) return false;
  const item = $from.parent;
  const list = $from.node($from.depth - 1);
  if (list.type !== schema.nodes.list) return false;

  if (item.content.size === 0) {
    // Empty item → exit the list into a fresh paragraph.
    if (dispatch) {
      const listBefore = $from.before($from.depth - 1);
      const listAfter = listBefore + list.nodeSize;
      const itemBefore = $from.before($from.depth);
      let tr = state.tr;
      if (list.childCount === 1) {
        tr = tr.replaceWith(listBefore, listAfter, schema.node('paragraph'));
        tr = tr.setSelection(TextSelection.create(tr.doc, listBefore + 1));
      } else {
        tr = tr.delete(itemBefore, itemBefore + item.nodeSize);
        const at = tr.mapping.map(listAfter);
        tr = tr.insert(at, schema.node('paragraph'));
        tr = tr.setSelection(TextSelection.create(tr.doc, at + 1));
      }
      dispatch(tr.scrollIntoView());
    }
    return true;
  }

  // Non-empty → split into a new item at the same level (a new item is unchecked).
  if (dispatch) {
    const tr = state.tr.split($from.pos, 1, [
      { type: schema.nodes.list_item, attrs: { level: item.attrs.level, checked: false } }
    ]);
    dispatch(tr.scrollIntoView());
  }
  return true;
};

```

`enterList` first bails unless the selection is an empty caret inside a
`list_item` whose parent is a `list`. On an **empty** item it exits the list: when
that item is the list's only child it replaces the whole list with a fresh
paragraph, otherwise it deletes just the item and inserts a paragraph after the
list — mapping positions through the deletion first — and drops the caret into the
new paragraph. On a **non-empty** item it splits at the cursor into a new
`list_item` at the same `level` (unchecked). Every dispatched path scrolls the
result into view and returns `true` to claim the key.

## `indentList` — change an item's nesting level

### Tab / Shift-Tab: clamp the item's `level` between 0 and 8

```ts
/** Tab / Shift-Tab: change the current item's nesting level (0–8). */
export function indentList(dir: 1 | -1): Command {
  return (state, dispatch) => {
    const { $from } = state.selection;
    if ($from.parent.type !== schema.nodes.list_item) return false;
    const item = $from.parent;
    const level = Math.max(0, Math.min(8, (Number(item.attrs.level) || 0) + dir));
    if (dispatch && level !== item.attrs.level) {
      const itemBefore = $from.before($from.depth);
      dispatch(state.tr.setNodeMarkup(itemBefore, undefined, { ...item.attrs, level }));
    }
    return true;
  };
}
```

`indentList` is a factory: it takes a direction (`1` for Tab, `-1` for
Shift-Tab) and returns the actual `Command`. The command returns `false` outside a
`list_item`; otherwise it computes the next `level`, clamped to the 0–8 range, and
only dispatches a `setNodeMarkup` when the level actually changes (preserving the
item's other attrs). It returns `true` whenever the caret is in a list, so Tab
never falls through to the browser's focus handling there.
