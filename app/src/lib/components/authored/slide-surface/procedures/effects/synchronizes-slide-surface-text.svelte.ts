import { tick } from "svelte";

import type { SurfaceTextSelection } from "$authored-components/slide-surface/slide-surface-types";

type TextRange = { readonly from: number; readonly to: number };

const sameRange = (
  left: TextRange | undefined,
  right: TextRange | undefined
): boolean =>
  left?.from === right?.from && left?.to === right?.to;

type Context = {
  readonly editing: () => boolean;
  readonly host: () => HTMLDivElement | null;
  readonly display: () => string;
  readonly size: () => number;
  readonly fit: () => boolean;
  readonly selection: () => SurfaceTextSelection | undefined;
  readonly pendingCaret: () => number | undefined;
  readonly takePendingCaret: () => number | undefined;
  readonly range: () => TextRange | undefined;
  readonly report: () => void;
  readonly placeCaret: (at: number) => void;
  readonly placeSelection: (from: number, to: number) => void;
  readonly caretFromPoint: () => boolean;
  readonly clearLastPoint: () => void;
  readonly setShrink: (value: number) => void;
};

/** Browser selection, caret, and fit lifecycles for one mounted slide text host. */
export const synchronizesSlideSurfaceText = (context: Context): void => {
  $effect(() => {
    if (!context.editing()) return;
    const report = context.report;
    document.addEventListener("selectionchange", report);
    return () => document.removeEventListener("selectionchange", report);
  });

  $effect(() => {
    void context.display();
    if (!context.editing() || context.pendingCaret() === undefined) return;
    const at = context.takePendingCaret();
    if (at === undefined) return;
    void tick().then(() => {
      context.host()?.focus({ preventScroll: true });
      context.placeCaret(at);
      context.report();
    });
  });

  $effect(() => {
    const element = context.host();
    if (!context.editing() || element === null) return;
    const wanted = context.selection();
    // A selection reported by this focused editor is an observation, not an
    // instruction to replay its previous caret after the next typed character.
    if (document.activeElement === element) return;
    if (wanted !== undefined && sameRange(context.range(), wanted)) return;
    void tick().then(() => {
      if (wanted !== undefined && sameRange(context.range(), wanted)) return;
      element.focus({ preventScroll: true });
      if (!context.caretFromPoint()) {
        if (wanted === undefined) context.placeCaret(context.display().length);
        else context.placeSelection(wanted.from, wanted.to);
      }
      context.clearLastPoint();
      context.report();
    });
  });

  $effect(() => {
    const size = context.size();
    const element = context.host();
    if (!context.fit() || element === null) {
      context.setShrink(1);
      return;
    }
    const box = element.parentElement;
    if (box === null) return;
    context.setShrink(1);
    void tick().then(() => {
      let factor = 1;
      for (let step = 0; step < 12 && element.scrollHeight > box.clientHeight + 1; step += 1) {
        factor *= 0.92;
        element.style.fontSize = `${size * factor}px`;
      }
      context.setShrink(factor);
    });
  });
};
