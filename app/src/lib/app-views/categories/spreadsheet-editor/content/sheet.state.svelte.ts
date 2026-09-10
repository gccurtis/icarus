import type { SurfaceApi, SurfaceHit, SurfaceSelection } from "$authored-components/sheet-surface";
import {
  initialReferenceGesture,
  type ReferenceGesture
} from "$app-views/categories/spreadsheet-editor/procedures/reference-picking";

export type ScrollTarget = { readonly row: number; readonly column: number; readonly token: number };

export type ReferencePick = {
  readonly session: number;
  readonly selection: SurfaceSelection;
};

export type SheetHeld = {
  api: SurfaceApi | undefined;
  wrapper: HTMLDivElement | undefined;
  notice: string | undefined;
  scrollTarget: ScrollTarget | undefined;
  hit: SurfaceHit | undefined;
  landed: string | undefined;
  referencePick: ReferencePick | undefined;
  referenceGesture: ReferenceGesture;
  scrolls: number;
  noticeTimer: ReturnType<typeof setTimeout> | undefined;
};

/**
 * What one open sheet holds for as long as it is on screen.
 *
 * All of it is the screen's rather than the sheet's: the surface's handle, the
 * element the keyboard is bound to, a message that fades, the cell a scroll was
 * asked for, the last right-click, the tab focus already answered, and the
 * transient range being pointed at while a formula is written. A sheet reopened
 * in another tab starts each of them again, which is why they are constructed
 * here and not kept anywhere longer-lived.
 */
export const createSheetState = (): SheetHeld => {
  let api = $state<SurfaceApi | undefined>(undefined);
  let wrapper = $state<HTMLDivElement | undefined>(undefined);
  let notice = $state<string | undefined>(undefined);
  let scrollTarget = $state<ScrollTarget | undefined>(undefined);
  let hit = $state<SurfaceHit | undefined>(undefined);
  let landed = $state<string | undefined>(undefined);
  let referencePick = $state<ReferencePick | undefined>(undefined);
  let referenceGesture = $state<ReferenceGesture>(initialReferenceGesture());

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
    get referencePick() {
      return referencePick;
    },
    set referencePick(next) {
      referencePick = next;
    },
    get referenceGesture() {
      return referenceGesture;
    },
    set referenceGesture(next) {
      referenceGesture = next;
    },
    scrolls: 0,
    noticeTimer: undefined
  };
};
