import { untrack } from "svelte";

import type { SurfaceHeld } from "$authored-components/sheet-surface/sheet-surface.state.svelte";
import type { SurfaceSelection } from "$authored-components/sheet-surface/sheet-surface-types";

export type Target = { readonly row: number; readonly column: number; readonly token: number };

const centreOf = (held: SurfaceSelection | undefined): { row: number; column: number } | undefined => {
  if (held === undefined) return undefined;
  if (held.ranges.length > 0) {
    const rows = held.ranges.flatMap((rect) => [rect.row, rect.row + rect.rows - 1]);
    const columns = held.ranges.flatMap((rect) => [rect.column, rect.column + rect.columns - 1]);
    return {
      row: Math.round((Math.min(...rows) + Math.max(...rows)) / 2),
      column: Math.round((Math.min(...columns) + Math.max(...columns)) / 2)
    };
  }
  if (held.cell !== undefined) return { row: held.cell[1], column: held.cell[0] };
  if (held.rows.length > 0) {
    return { row: Math.round((Math.min(...held.rows) + Math.max(...held.rows)) / 2), column: 0 };
  }
  if (held.columns.length > 0) {
    return { row: 0, column: Math.round((Math.min(...held.columns) + Math.max(...held.columns)) / 2) };
  }
  return undefined;
};

export type Scrolling = {
  readonly held: SurfaceHeld;
  readonly target: () => Target | undefined;
  readonly zoom: () => number;
  readonly selection: () => SurfaceSelection | undefined;
};

/**
 * The two reasons the grid moves on its own: somebody asked for a cell, and the
 * drawing changed size under a selection that should stay where it was.
 *
 * Zoom keeps what is chosen in the middle rather than what the scroll position
 * happened to be showing — the reader is looking at their selection, and a zoom
 * that leaves it off screen has moved them somewhere they did not ask to be.
 */
export const scrollsToACell = (scrolling: Scrolling): void => {
  const held = scrolling.held;

  $effect(() => {
    const asked = scrolling.target();
    if (asked === undefined) return;

    held.ref.current?.scrollTo(asked.column, asked.row, "both", 0, 0, {
      hAlign: "center",
      vAlign: "center"
    });
  });

  $effect(() => {
    const next = scrolling.zoom();
    const previous = held.zoomed;
    held.zoomed = next;
    if (previous === undefined || previous === next) return;

    const centre = untrack(() => centreOf(scrolling.selection()));
    if (centre === undefined) return;

    requestAnimationFrame(() => {
      held.ref.current?.scrollTo(centre.column, centre.row, "both", 0, 0, {
        hAlign: "center",
        vAlign: "center"
      });
    });
  });
};
