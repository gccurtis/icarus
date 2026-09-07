import { Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";

const PROMPT_MARKERS = new PluginKey<DecorationSet>("document-prompt-markers");

const marker = (blockId: string, open: (blockId: string) => void): HTMLButtonElement => {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "document-prompt-marker";
  button.dataset.promptBlock = blockId;
  button.contentEditable = "false";
  button.textContent = "✦";
  button.title = "Open Prompt Block settings";
  button.setAttribute("aria-label", "Open Prompt Block settings");
  button.addEventListener("mousedown", (event) => event.preventDefault());
  button.addEventListener("click", (event) => {
    event.stopPropagation();
    open(blockId);
  });
  return button;
};

/** Adds one out-of-content authoring affordance to every editable Prompt Block. */
export const promptMarkers = (open: (blockId: string) => void): Plugin<DecorationSet> =>
  new Plugin({
    key: PROMPT_MARKERS,
    props: {
      decorations(state) {
        const decorations: Decoration[] = [];
        state.doc.descendants((node, at) => {
          if (node.type.name !== "text_block" || node.attrs.kind !== "prompt") return;
          const blockId = node.attrs.blockId;
          if (typeof blockId !== "string") return;

          decorations.push(
            Decoration.widget(at + node.nodeSize - 1, () => marker(blockId, open), {
              key: `prompt-marker:${blockId}`,
              side: 1,
              stopEvent: () => true
            })
          );
        });
        return DecorationSet.create(state.doc, decorations);
      }
    }
  });
