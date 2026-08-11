# src/lib/features/stages/document/editor/selection-highlight.ts — breakdown

Companion to [selection-highlight.ts](selection-highlight.ts). A ProseMirror plugin that
keeps a text selection visibly highlighted while the editor is blurred, so operating the
inspector (which takes focus away from the editor) does not appear to drop the selection.

## Imports, intent, and the focus key

### The plugin/decoration imports, the rationale comment, and the plugin key

```ts
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

// The browser hides the native ::selection highlight when the editor loses focus,
// so operating the inspector (clicking a swatch, opening a select) appears to drop
// the selection even though ProseMirror still holds the range. This plugin paints an
// equivalent inline decoration over the range whenever the view is blurred, so the
// selection stays visible while the user works the side panel.

const focusKey = new PluginKey<boolean>('taurusSelectionHold');

```

`Plugin`/`PluginKey` come from `prosemirror-state`, `Decoration`/`DecorationSet` from
`prosemirror-view`. The comment records why the plugin exists: ProseMirror keeps its
selection across blur, but the browser stops painting `::selection`, so the range looks
lost while the side panel is in use. `focusKey` is the plugin key whose state is a single
boolean — whether the view currently has focus.

## The plugin: focus-tracking state, DOM handlers, and the hold decoration

### `selectionHighlightPlugin` — track focus, and decorate the range only while blurred

```ts
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
```

The plugin state initializes focused and only changes when a `blur`/`focus` DOM event
dispatches a metadata-only transaction carrying the new boolean (the events don't otherwise
produce transactions, so this is what makes the `decorations` prop recompute). While focused
it draws nothing — the native `::selection` shows; while blurred with a non-empty selection it
returns a single inline `Decoration` (class `taurus-selection-hold`, styled to match the native
selection wash) over the range. The `handleDOMEvents` handlers return `false` so they never
consume the event.
