import { createRef, type RefObject } from "react";
import type { DataEditorRef } from "@glideapps/glide-data-grid";
import type { Root } from "react-dom/client";

import type { Measure } from "$authored-components/sheet-surface/sheet-surface-theme";

export type Region = { readonly x: number; readonly y: number; readonly width: number; readonly height: number; readonly tick: number };

export type Size = { readonly width: number; readonly height: number };

export type Offset = { readonly left: number; readonly top: number };

export type SurfaceHeld = {
  frame: HTMLDivElement | undefined;
  host: HTMLDivElement | undefined;
  measure: Measure | undefined;
  size: Size;
  drafts: Record<number, number>;
  rowDrafts: Record<number, number>;
  focused: boolean;
  region: Region;
  dragging: boolean;
  offset: Offset;
  root: Root | undefined;
  zoomed: number | undefined;
  readonly ref: RefObject<DataEditorRef>;
};

/**
 * Everything one grid holds while it is on screen.
 *
 * Two elements, the measurement taken from them, the React root mounted into
 * them, and the sizes a drag is proposing before anybody has agreed to them.
 * None of it outlives the component, and none of it belongs to another grid, so
 * the component constructs one of these rather than reading a module.
 *
 * `root`, `zoomed` and `ref` are deliberately outside the reactive set: they are
 * the library's own handles, and re-running anything when they change would
 * re-enter the library while it is mid-render.
 */
export const createSurfaceState = (): SurfaceHeld => {
  let frame = $state<HTMLDivElement | undefined>(undefined);
  let host = $state<HTMLDivElement | undefined>(undefined);
  let measure = $state<Measure | undefined>(undefined);
  let size = $state<Size>({ width: 0, height: 0 });
  let drafts = $state<Record<number, number>>({});
  let rowDrafts = $state<Record<number, number>>({});
  let focused = $state(false);
  let region = $state<Region>({ x: 0, y: 0, width: 0, height: 0, tick: 0 });
  let dragging = $state(false);
  let offset = $state<Offset>({ left: 0, top: 0 });

  return {
    get frame() {
      return frame;
    },
    set frame(next) {
      frame = next;
    },
    get host() {
      return host;
    },
    set host(next) {
      host = next;
    },
    get measure() {
      return measure;
    },
    set measure(next) {
      measure = next;
    },
    get size() {
      return size;
    },
    set size(next) {
      size = next;
    },
    get drafts() {
      return drafts;
    },
    set drafts(next) {
      drafts = next;
    },
    get rowDrafts() {
      return rowDrafts;
    },
    set rowDrafts(next) {
      rowDrafts = next;
    },
    get focused() {
      return focused;
    },
    set focused(next) {
      focused = next;
    },
    get region() {
      return region;
    },
    set region(next) {
      region = next;
    },
    get dragging() {
      return dragging;
    },
    set dragging(next) {
      dragging = next;
    },
    get offset() {
      return offset;
    },
    set offset(next) {
      offset = next;
    },
    root: undefined,
    zoomed: undefined,
    ref: createRef<DataEditorRef>()
  };
};
