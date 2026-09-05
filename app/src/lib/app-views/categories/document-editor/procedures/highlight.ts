import { Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";

export const HELD = new PluginKey<boolean>("document-editor.held-selection");

export const heldSelection = (): Plugin<boolean> =>
  new Plugin<boolean>({
    key: HELD,
    state: {
      init: () => false,
      apply: (transaction, held) => {
        const set = transaction.getMeta(HELD);
        return typeof set === "boolean" ? set : held;
      }
    },
    props: {
      decorations: (state) => {
        if (HELD.getState(state) !== true) return DecorationSet.empty;

        if (state.selection.empty) return DecorationSet.empty;

        return DecorationSet.create(
          state.doc,
          state.selection.ranges.map((range) =>
            Decoration.inline(range.$from.pos, range.$to.pos, { class: "held-selection" })
          )
        );
      },
      handleDOMEvents: {
        blur: (view) => {
          view.dispatch(view.state.tr.setMeta(HELD, true).setMeta("addToHistory", false));
          return false;
        },
        focus: (view) => {
          view.dispatch(view.state.tr.setMeta(HELD, false).setMeta("addToHistory", false));
          return false;
        }
      }
    }
  });
