import type { Pin } from "$app-views/categories/document-editor/procedures/annotations";

export type DocumentPins = {
  readonly comments: readonly Pin[];
  readonly prompts: readonly { readonly id: string; readonly top: number }[];
};

export type DocumentHeld = {
  host: HTMLDivElement | undefined;
  surface: HTMLDivElement | undefined;
  pageFrame: HTMLDivElement | undefined;
  available: number;
  pins: DocumentPins;
  editorError: string | undefined;
};

/** State whose lifetime is exactly one mounted document surface. */
export const createDocumentState = (): DocumentHeld => {
  let host = $state<HTMLDivElement | undefined>(undefined);
  let surface = $state<HTMLDivElement | undefined>(undefined);
  let pageFrame = $state<HTMLDivElement | undefined>(undefined);
  let available = $state(0);
  let pins = $state<DocumentPins>({ comments: [], prompts: [] });
  let editorError = $state<string | undefined>(undefined);

  return {
    get host() { return host; },
    set host(next) { host = next; },
    get surface() { return surface; },
    set surface(next) { surface = next; },
    get pageFrame() { return pageFrame; },
    set pageFrame(next) { pageFrame = next; },
    get available() { return available; },
    set available(next) { available = next; },
    get pins() { return pins; },
    set pins(next) { pins = next; },
    get editorError() { return editorError; },
    set editorError(next) { editorError = next; }
  };
};
