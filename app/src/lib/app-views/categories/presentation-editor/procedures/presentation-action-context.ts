import type { SurfaceFrame, SurfaceGuide, SurfacePoint } from "$authored-components/slide-surface";
import type { PresentationHeld } from "$app-views/categories/presentation-editor/content/presentation.state.svelte";
import type {
  Frame,
  Slide,
  PresentationBody
} from "$app-views/categories/presentation-editor/procedures/presentation-types";
import type { PresentationRuntime, WorkspaceStateModel } from "$model/client/workspace-state";

export type PresentationActionContext = {
  readonly view: WorkspaceStateModel;
  readonly runtime: PresentationRuntime | undefined;
  readonly held: PresentationHeld;
  readonly presentationId: string | undefined;
  readonly body: PresentationBody | undefined;
  readonly slide: Slide | undefined;
  readonly selected: readonly string[];
  readonly cells: readonly string[];
  readonly units: { readonly width: number; readonly height: number };
  readonly size: { readonly width: number; readonly height: number };
  readonly geometry: PresentationRuntime["stage"] | undefined;
  readonly index: number;
};

export type PresentationSelectionActions = {
  readonly apply: (ops: readonly Parameters<PresentationRuntime["apply"]>[0][number][]) => void;
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

export type PresentationGeometryActions = {
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
