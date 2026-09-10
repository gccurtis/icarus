import type { SurfaceFrame, SurfaceGuide, SurfacePoint } from "$authored-components/slide-surface";
import type { DeckHeld } from "$app-views/categories/slide-deck-editor/content/deck.state.svelte";
import type {
  Frame,
  Slide,
  SlideDeckBody
} from "$app-views/categories/slide-deck-editor/procedures/deck-types";
import type { SlideDeckRuntime, WorkspaceStateModel } from "$model/client/workspace-state";

export type DeckActionContext = {
  readonly view: WorkspaceStateModel;
  readonly runtime: SlideDeckRuntime | undefined;
  readonly held: DeckHeld;
  readonly deckId: string | undefined;
  readonly body: SlideDeckBody | undefined;
  readonly slide: Slide | undefined;
  readonly selected: readonly string[];
  readonly cells: readonly string[];
  readonly units: { readonly width: number; readonly height: number };
  readonly size: { readonly width: number; readonly height: number };
  readonly geometry: SlideDeckRuntime["stage"] | undefined;
  readonly index: number;
};

export type DeckSelectionActions = {
  readonly apply: (ops: readonly Parameters<SlideDeckRuntime["apply"]>[0][number][]) => void;
  readonly show: (slideId: string) => void;
  readonly select: (ids: string[]) => void;
  readonly pickCells: (tableId: string, ids: string[]) => void;
  readonly clear: () => void;
  readonly enter: (id: string, blockId: string) => void;
  readonly startTyping: (elementId: string, typed: string) => void;
  readonly exit: () => void;
  readonly edited: (change: { readonly blockId: string; readonly from: number; readonly to: number; readonly insert: string }) => void;
  readonly caret: (blockId: string, from: number, to: number) => void;
  readonly badge: (id: string) => void;
  readonly prompt: (id: string) => void;
};

export type DeckGeometryActions = {
  readonly frames: (moves: readonly { readonly id: string; readonly frame: Frame }[]) => void;
  readonly grow: (id: string, height: number) => void;
  readonly rotate: (id: string, rotation: number) => void;
  readonly line: (id: string, from: SurfacePoint, to: SurfacePoint) => void;
  readonly snap: (
    frame: SurfaceFrame,
    id: string,
    alt: boolean
  ) => { readonly frame: SurfaceFrame; readonly guides: SurfaceGuide[] };
};
