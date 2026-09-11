import type { SurfacePoint } from "$authored-components/slide-surface";

export type PresentationHeld = {
  surface: HTMLDivElement | null;
  board: HTMLDivElement | null;
  available: { readonly width: number; readonly height: number };
  editing: string | undefined;
  insertAt: SurfacePoint | undefined;
  pointed: SurfacePoint | undefined;
  onSlide: boolean;
  shownSlide: string | undefined;
};

/** State whose lifetime is exactly one mounted presentation surface. */
export const createPresentationState = (): PresentationHeld => {
  let surface = $state<HTMLDivElement | null>(null);
  let board = $state<HTMLDivElement | null>(null);
  let available = $state({ width: 0, height: 0 });
  let editing = $state<string | undefined>(undefined);
  let insertAt = $state<SurfacePoint | undefined>(undefined);
  let pointed: SurfacePoint | undefined;
  let onSlide = false;
  let shownSlide: string | undefined;

  return {
    get surface() { return surface; },
    set surface(next) { surface = next; },
    get board() { return board; },
    set board(next) { board = next; },
    get available() { return available; },
    set available(next) { available = next; },
    get editing() { return editing; },
    set editing(next) { editing = next; },
    get insertAt() { return insertAt; },
    set insertAt(next) { insertAt = next; },
    get pointed() { return pointed; },
    set pointed(next) { pointed = next; },
    get onSlide() { return onSlide; },
    set onSlide(next) { onSlide = next; },
    get shownSlide() { return shownSlide; },
    set shownSlide(next) { shownSlide = next; }
  };
};
