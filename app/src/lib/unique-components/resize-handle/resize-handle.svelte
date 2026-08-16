<script lang="ts">
  import { cn } from "$lib/simple-components/utils";

  /**
   * The grab strip on a flank's inner edge.
   *
   * It owns the gesture and the arithmetic; the caller owns the numbers. That
   * split is what lets one component serve both flanks: a drag on the left and a
   * drag on the right differ only in sign, and everything else — clamping, the
   * threshold below which a drag collapses rather than squeezes, the keyboard
   * equivalent — is the same work twice if each panel writes it.
   *
   * It reports a width *and* a collapsed flag together, in one call, because
   * they are one decision. Reporting them separately would let a caller apply
   * half of a gesture.
   *
   * **Collapsing is a throw, not a nudge.** The threshold is well below the
   * minimum rather than at it, so easing up to the minimum stops there and only
   * a deliberate push past it collapses. A threshold at the minimum makes the
   * last few pixels of every resize feel like a trapdoor.
   *
   * **Collapsing preserves the width, it does not overwrite it.** The gesture
   * that shuts a panel reports the last width the panel was legitimately at, so
   * reopening returns to the size the user chose rather than to the minimum.
   * Reporting the clamped pointer position instead is the obvious implementation
   * and it silently destroys that width: every collapse would be followed by
   * having to drag the panel back out to where it already was.
   */
  let {
    side,
    width,
    collapsed,
    min,
    max,
    collapseBelow,
    label,
    onchange
  }: {
    /** Which flank this edge belongs to; decides the sign of a drag. */
    side: "start" | "end";
    /** The panel's current visible width in pixels, ignoring collapse. */
    width: number;
    collapsed: boolean;
    min: number;
    max: number;
    /** Drag below this and the panel collapses instead of clamping. */
    collapseBelow: number;
    /** Names the panel this resizes, for assistive technology. */
    label: string;
    onchange: (next: { width: number; collapsed: boolean }) => void;
  } = $props();

  let dragging = $state(false);

  const clamp = (value: number) => Math.max(min, Math.min(max, value));

  const onpointerdown = (event: PointerEvent) => {
    event.preventDefault();
    const handle = event.currentTarget as HTMLElement;
    handle.setPointerCapture(event.pointerId);

    const startX = event.clientX;
    // A collapsed panel is dragged out from its minimum, not from zero, so the
    // first pixel of movement produces a usable panel rather than a sliver.
    const startWidth = collapsed ? min : width;
    const direction = side === "start" ? 1 : -1;
    dragging = true;

    const move = (moved: PointerEvent) => {
      const proposed = startWidth + direction * (moved.clientX - startX);
      // A gesture that ends in a collapse reports the width it began with, not
      // the pointer's. Anything else loses the size the user had: the pixels
      // between the minimum and the threshold all clamp to the minimum, so
      // "remember the last valid width" would remember the minimum every time.
      onchange(
        proposed < collapseBelow
          ? { width: startWidth, collapsed: true }
          : { width: clamp(proposed), collapsed: false }
      );
    };

    const up = () => {
      dragging = false;
      handle.releasePointerCapture(event.pointerId);
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
      handle.removeEventListener("pointercancel", up);
    };

    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
    handle.addEventListener("pointercancel", up);
  };

  /**
   * The keyboard equivalent, which a pointer-only resize would leave out of the
   * primary workflow entirely. Arrows step, Home and End jump to the bounds, and
   * Enter toggles — because collapsing by holding an arrow key past a threshold
   * is a gesture nobody can perform deliberately.
   */
  const STEP = 16;

  const onkeydown = (event: KeyboardEvent) => {
    const outward = side === "start" ? "ArrowRight" : "ArrowLeft";
    const inward = side === "start" ? "ArrowLeft" : "ArrowRight";
    const current = collapsed ? min : width;

    if (event.key === outward) onchange({ width: clamp(current + STEP), collapsed: false });
    else if (event.key === inward) onchange({ width: clamp(current - STEP), collapsed: false });
    else if (event.key === "Home") onchange({ width: min, collapsed: false });
    else if (event.key === "End") onchange({ width: max, collapsed: false });
    else if (event.key === "Enter" || event.key === " ") onchange({ width: current, collapsed: !collapsed });
    else return;

    event.preventDefault();
  };
</script>

<!--
  A `separator` with a tabindex is the ARIA window-splitter: the role becomes a
  widget the moment it is focusable, and it then takes `aria-valuenow` and its
  bounds, which is exactly what is declared below. Svelte's rule reads
  `separator` as structural and cannot see the distinction, so the two warnings
  it raises here are about a pattern the specification names.
-->
<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  role="separator"
  aria-orientation="vertical"
  aria-label="Resize {label}"
  aria-valuenow={collapsed ? 0 : Math.round(width)}
  aria-valuemin={0}
  aria-valuemax={Math.round(max)}
  tabindex="0"
  data-slot="resize-handle"
  data-dragging={dragging ? "" : undefined}
  {onpointerdown}
  {onkeydown}
  class={cn(
    "absolute inset-y-0 z-20 w-1 cursor-col-resize transition-colors",
    side === "start" ? "end-0" : "start-0",
    dragging ? "bg-interactive-border" : "hover:bg-interactive-border/50"
  )}
></div>
