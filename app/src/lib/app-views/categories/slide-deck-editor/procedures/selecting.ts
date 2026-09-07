import type { SlideElement } from "$representation/data/types/slide-decks/body";
import type { Selection } from "$representation/data/types/workspace/tab";
import type { InspectorView } from "$representation/data/types/workspace/views";

export type { Selection } from "$representation/data/types/workspace/tab";
export type { InspectorView } from "$representation/data/types/workspace/views";

export type Signal = { readonly key: InspectorView; readonly selection: Selection };

export type Address = { readonly blockId: string; readonly offset: number };

export const ELEMENTS = "elements";

export const CELLS = "cells";

export const selectedIds = (selection: Selection | undefined): readonly string[] =>
  selection?.kind === ELEMENTS ? (selection.ids ?? [selection.id]) : selection?.kind === CELLS ? [selection.id] : [];

export const selectedCells = (selection: Selection | undefined): readonly string[] =>
  selection?.kind === CELLS ? (selection.ids ?? []) : [];

export const cellsSignal = (tableId: string, cellIds: readonly string[]): Signal => ({
  key: "slide-deck-editor.cell",
  selection: { kind: CELLS, id: tableId, ids: cellIds }
});

const LENS: Record<SlideElement["content"]["type"], InspectorView> = {
  text: "slide-deck-editor.text-box",
  formula: "document-editor.formula",
  prompt: "slide-deck-editor.prompt-block",
  shape: "slide-deck-editor.shape",
  line: "slide-deck-editor.line",
  image: "slide-deck-editor.image",
  table: "slide-deck-editor.table",
  chart: "slide-deck-editor.chart",
  group: "slide-deck-editor.group"
};

export const elementsSignal = (elements: readonly SlideElement[]): Signal | undefined => {
  if (elements.length === 0) return undefined;
  const ids = elements.map((element) => element.id);
  return {
    key: elements.length === 1 ? LENS[elements[0].content.type] : "slide-deck-editor.multi-selection",
    selection: { kind: ELEMENTS, id: ids[0], ids }
  };
};

export const slideSignal = (slideId: string): Signal => ({
  key: "slide-deck-editor.slide",
  selection: { kind: "slide", id: slideId }
});

export const notesSignal = (slideId: string): Signal => ({
  key: "slide-deck-editor.speaker-notes",
  selection: { kind: "notes", id: slideId }
});

export const threadsSignal = (elementId: string): Signal => ({
  key: "slide-deck-editor.threads",
  selection: { kind: "threads", id: elementId }
});

export const textSignal = (blockId: string, from: number, to: number): Signal =>
  from === to
    ? { key: "slide-deck-editor.next-letter", selection: { kind: "next-letter", id: `${blockId}@${from}` } }
    : {
        key: "slide-deck-editor.text-selection",
        selection: { kind: "text-selection", id: `${blockId}@${Math.min(from, to)}`, at: `${blockId}@${Math.max(from, to)}` }
      };

export const addressOf = (held: string | undefined): Address | undefined => {
  if (held === undefined) return undefined;
  const [blockId, at] = held.split("@");
  const offset = Number(at);
  if (!blockId || !Number.isInteger(offset)) return undefined;
  return { blockId, offset };
};

export const rangeOf = (selection: Selection | undefined): { blockId: string; from: number; to: number } | undefined => {
  if (selection?.kind !== "text-selection" && selection?.kind !== "next-letter") return undefined;
  const from = addressOf(selection.id);
  if (from === undefined) return undefined;
  const to = addressOf(selection.at) ?? from;
  return { blockId: from.blockId, from: from.offset, to: to.offset };
};

export const sameSelection = (a: Selection | undefined, b: Selection | undefined): boolean =>
  a?.kind === b?.kind && a?.id === b?.id && a?.at === b?.at && (a?.ids ?? []).join() === (b?.ids ?? []).join();
