import { mount, unmount } from "svelte";
import type { Node as ProseMirrorNode } from "prosemirror-model";
import type { NodeView, NodeViewConstructor } from "prosemirror-view";

import PromptOutput from "$app-views/categories/document-editor/components/prompt-output.svelte";
import type { PromptBlock } from "$representation/data/types/content/content-block";

const shell = (node: ProseMirrorNode): HTMLDivElement => {
  const dom = document.createElement("div");
  dom.className = "document-block document-prompt";
  dom.dataset.block = String(node.attrs.blockId);
  dom.style.flexBasis = `${Number(node.attrs.share) * 100}%`;
  dom.contentEditable = "false";
  return dom;
};

/** Mount the live Svelte resolver at the ProseMirror atom boundary. */
export const promptNodeView: NodeViewConstructor = (node): NodeView => {
  const dom = shell(node);
  const block = node.attrs.block as PromptBlock | null;
  const id = block?.derivedOutputId;

  if (id === undefined) {
    const empty = document.createElement("span");
    empty.className = "document-prompt-unlinked";
    empty.textContent = "This prompt block is not linked to a Derived Output.";
    dom.append(empty);
    return { dom, ignoreMutation: () => true };
  }

  const component = mount(PromptOutput, {
    target: dom,
    props: { derivedOutputId: id, surface: "document" }
  });

  return {
    dom,
    /** Controls inside the atom own their pointer and keyboard gestures. */
    stopEvent: (event) =>
      event.target instanceof Element && event.target.closest("button, a, input, textarea") !== null,
    /** Remote-query repaints are presentation, never document mutations. */
    ignoreMutation: () => true,
    destroy: () => {
      void unmount(component);
    }
  };
};
