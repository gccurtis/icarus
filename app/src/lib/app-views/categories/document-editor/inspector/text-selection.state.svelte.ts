import type { DocumentRuntime } from "$model/client/workspace-state";

export type TextSelectionState = {
  runtime: DocumentRuntime | undefined;
  composing: string;
  linkUrl: string;
  linkNote: string;
  linkFailed: string | undefined;
  editingLink: string | undefined;
  editLinkUrl: string;
  editLinkNote: string;
};

/** Transient fields owned by one mounted text-selection inspector. */
export const createTextSelectionState = (): TextSelectionState => {
  let runtime = $state<DocumentRuntime>();
  let composing = $state("");
  let linkUrl = $state("");
  let linkNote = $state("");
  let linkFailed = $state<string>();
  let editingLink = $state<string>();
  let editLinkUrl = $state("");
  let editLinkNote = $state("");

  return {
    get runtime() { return runtime; },
    set runtime(next) { runtime = next; },
    get composing() { return composing; },
    set composing(next) { composing = next; },
    get linkUrl() { return linkUrl; },
    set linkUrl(next) { linkUrl = next; },
    get linkNote() { return linkNote; },
    set linkNote(next) { linkNote = next; },
    get linkFailed() { return linkFailed; },
    set linkFailed(next) { linkFailed = next; },
    get editingLink() { return editingLink; },
    set editingLink(next) { editingLink = next; },
    get editLinkUrl() { return editLinkUrl; },
    set editLinkUrl(next) { editLinkUrl = next; },
    get editLinkNote() { return editLinkNote; },
    set editLinkNote(next) { editLinkNote = next; }
  };
};
