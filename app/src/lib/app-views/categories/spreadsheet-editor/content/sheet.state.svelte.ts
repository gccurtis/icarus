import type { SurfaceApi, SurfaceHit } from "$authored-components/sheet-surface";

export type ScrollTarget = { readonly row: number; readonly column: number; readonly token: number };

export type SheetHeld = {
  api: SurfaceApi | undefined;
  wrapper: HTMLDivElement | undefined;
  notice: string | undefined;
  scrollTarget: ScrollTarget | undefined;
  hit: SurfaceHit | undefined;
  landed: string | undefined;
  scrolls: number;
  noticeTimer: ReturnType<typeof setTimeout> | undefined;
};

/**
 * What one open sheet holds for as long as it is on screen.
 *
 * All of it is the screen's rather than the sheet's: the surface's handle, the
 * element the keyboard is bound to, a message that fades, the cell a scroll was
 * asked for, the last right-click, and the tab focus already answered. A sheet
 * reopened in another tab starts each of them again, which is why they are
 * constructed here and not kept anywhere longer-lived.
 */
export const createSheetState = (): SheetHeld => {
  let api = $state<SurfaceApi | undefined>(undefined);
  let wrapper = $state<HTMLDivElement | undefined>(undefined);
  let notice = $state<string | undefined>(undefined);
  let scrollTarget = $state<ScrollTarget | undefined>(undefined);
  let hit = $state<SurfaceHit | undefined>(undefined);
  let landed = $state<string | undefined>(undefined);

  return {
    get api() {
      return api;
    },
    set api(next) {
      api = next;
    },
    get wrapper() {
      return wrapper;
    },
    set wrapper(next) {
      wrapper = next;
    },
    get notice() {
      return notice;
    },
    set notice(next) {
      notice = next;
    },
    get scrollTarget() {
      return scrollTarget;
    },
    set scrollTarget(next) {
      scrollTarget = next;
    },
    get hit() {
      return hit;
    },
    set hit(next) {
      hit = next;
    },
    get landed() {
      return landed;
    },
    set landed(next) {
      landed = next;
    },
    scrolls: 0,
    noticeTimer: undefined
  };
};
