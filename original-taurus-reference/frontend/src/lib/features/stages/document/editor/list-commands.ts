import { TextSelection, type Command } from 'prosemirror-state';
import { schema } from './schema';

/**
 * Keymap commands for the flat `list` node (items carry a `level` attr rather than
 * nesting). Each returns false outside a list so the base keymap still runs.
 */

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
