<script lang="ts">
  import { cn } from "$lib/simple-components/utils";

  /**
   * A piece of content, and the three ways it can be sized.
   *
   * **A content block is data. The box around it is not.** This component draws
   * a block's *content* and nothing else by default — no outline, no handles, no
   * hover state. Chrome is a separate, opt-in layer that a surface turns on when
   * its own conventions call for it, which in practice means slides and never
   * documents. A document made of visible blocks reads as a form, and the block
   * boundaries are an implementation detail leaking onto the page.
   *
   * That split is why `chrome` is a prop rather than a fact about the component.
   * The same block, the same data, appears bare in a document and framed on a
   * slide, and neither surface is rendering something the other is not.
   *
   * **Three sizings, and each belongs to a surface:**
   *
   * - `flow` — the width is the measure and the height follows the text. What a
   *   document is made of: a paragraph cannot choose its own width without
   *   breaking the column, and cannot have a fixed height without either
   *   clipping or leaving a hole.
   * - `grow` — the width follows the text up to a maximum, and the height is
   *   set by dragging. A slide's text object: a title that is four words wide
   *   should be four words wide, because on a slide the box is a composition
   *   element rather than a column.
   * - `fixed` — both are set and neither moves. A shape, an image, a chart
   *   placed on a slide: its size is the point, and text inside it is a
   *   passenger.
   *
   * **Overflow is visible in `fixed` and only there.** A fixed box whose content
   * no longer fits is a mistake the author has to be able to see; clipping it
   * silently is how a slide gets printed with half a sentence.
   */
  let {
    sizing = "flow",
    chrome = false,
    selected = false,
    width,
    height,
    maxWidth = "38rem",
    label,
    onselect,
    children
  }: {
    sizing?: "flow" | "grow" | "fixed";
    /** Draw the block's own edges. A slide's convention, never a document's. */
    chrome?: boolean;
    selected?: boolean;
    /** For `fixed`. Ignored by the other two, which derive it. */
    width?: string;
    /** For `fixed` and `grow`. `flow` derives it from the content. */
    height?: string;
    /** For `grow`: how wide the text is allowed to push before it wraps. */
    maxWidth?: string;
    /** Names it to assistive technology when it is selectable. */
    label?: string;
    onselect?: () => void;
    children: import("svelte").Snippet;
  } = $props();

  const box = $derived(
    sizing === "fixed"
      ? `width: ${width ?? "16rem"}; height: ${height ?? "8rem"};`
      : sizing === "grow"
        ? `max-width: ${maxWidth}; width: max-content; ${height ? `height: ${height};` : ""}`
        : `width: 100%;`
  );
</script>

<!--
  Never a button, even when selectable. A block holds editable text, and a
  textarea inside a button is invalid nesting the browser resolves by swallowing
  the click — the block could not be selected by clicking the very thing it is
  made of.

  **Selection follows focus**, which is the right model for an editor anyway:
  the selected block is the one the caret is in, so clicking the text does one
  thing rather than two competing ones, and tabbing between blocks selects them
  without a second gesture.
-->
<!--
  The rule below wants the listener on a widget. Here the widget is *inside* —
  the textarea the block is made of — and the block is the region around it that
  notices when focus arrives. Making the region itself a widget is what produced
  the invalid nesting in the first place.
-->
<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<div
  role="group"
  aria-label={label}
  aria-current={selected ? "true" : undefined}
  onfocusin={onselect}
  onclick={onselect}
  onkeydown={(event) => {
    if (event.key === "Enter" && event.target === event.currentTarget) onselect?.();
  }}
  style={box}
  class={cn(
    "border",
    /* Chrome off is genuinely nothing: no border, no padding, no radius. The
       block has to be invisible for a document to read as a document. */
    chrome
      ? "rounded-control border-border-subtle p-2"
      : "border-transparent p-0",
    onselect && chrome && "hover:border-interactive-border",
    selected && chrome && "border-active-border bg-active-surface",
    /* Dashed, not filled: a document that reflowed or changed colour when you
       clicked into it is a document you cannot read while editing. */
    selected && !chrome && "border-active-border border-dashed",
    sizing === "fixed" && "overflow-visible"
  )}
>
  <div class={cn("min-w-0", sizing === "fixed" && "h-full")}>
    {@render children()}
  </div>
</div>
