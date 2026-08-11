import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

// The browser hides the native ::selection highlight when the editor loses focus,
// so operating the inspector (clicking a swatch, opening a select) appears to drop
// the selection even though ProseMirror still holds the range. This plugin paints an
// equivalent inline decoration over the range whenever the view is blurred, so the
// selection stays visible while the user works the side panel.

const focusKey = new PluginKey<boolean>('taurusSelectionHold');

/** Keep a non-empty text selection visibly highlighted while the editor is blurred. */
export function selectionHighlightPlugin(): Plugin<boolean> {
  return new Plugin<boolean>({
    key: focusKey,
    // Plugin state is a single boolean: does the view currently have focus? It starts
    // focused and flips only on the DOM focus/blur events fed through as metadata.
    state: {
      init: () => true,
      apply: (tr, focused) => {
        const meta = tr.getMeta(focusKey);
        return typeof meta === 'boolean' ? meta : focused;
      }
    },
    props: {
      // Focus/blur don't produce transactions on their own; dispatch a metadata-only
      // transaction so the decoration recomputes when focus changes.
      handleDOMEvents: {
        blur: (view) => {
          view.dispatch(view.state.tr.setMeta(focusKey, false));
          return false;
        },
        focus: (view) => {
          view.dispatch(view.state.tr.setMeta(focusKey, true));
          return false;
        }
      },
      // Only paint the hold-highlight while blurred with a real range; when focused the
      // native ::selection shows and this returns nothing.
      decorations: (state) => {
        if (focusKey.getState(state)) return null;
        const { from, to, empty } = state.selection;
        if (empty) return null;
        return DecorationSet.create(state.doc, [
          Decoration.inline(from, to, { class: 'taurus-selection-hold' })
        ]);
      }
    }
  });
}
