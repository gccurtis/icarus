<script lang="ts">
  import { cn } from "$vendored-components/utils";
  import { traceNode } from "$development-components/trace.svelte";

  /**
   * Text inside a content block, edited where it sits.
   *
   * Separate from `ContentBlock` because the block is a *box* and this is what
   * happens to be in it — a block can hold an image, a chart or a shape, and
   * none of those want a caret.
   *
   * **It is a textarea that never looks like one.** No border, no fill, no
   * resize handle, inheriting every type property from the block around it. The
   * moment a document's paragraph looks like a form field, the document stops
   * reading as a document — which is the same rule that keeps chrome off blocks,
   * one level down.
   *
   * `field-sizing: content` is what makes the height follow the text without a
   * measuring loop, and it is why `flow` blocks need no height at all.
   */
  let {
    value = "",
    oninput,
    align = "start",
    size = "body",
    weight = "normal",
    placeholder = "",
    label,
    fill = false
  }: {
    value?: string;
    /**
     * Every keystroke, not a commit. A block's text is the document — there is
     * no moment at which a paragraph is "submitted", so there is nothing for a
     * commit gesture to mean. `PanelEditableText` is the opposite case and
     * commits deliberately, because it is editing a value that already exists
     * somewhere else.
     */
    oninput?: (next: string) => void;
    align?: "start" | "center" | "end";
    size?: "caption" | "body-sm" | "body" | "body-lg" | "h4" | "h3";
    weight?: "normal" | "medium" | "semibold";
    placeholder?: string;
    /** Accessible name. A block of text with no label is unreachable by name. */
    label: string;
    /** Fill the block's height, for a `fixed` box. */
    fill?: boolean;
  } = $props();

  const trace = traceNode("BlockText", () => ({
    value,
    align,
    size,
    weight,
    placeholder,
    label,
    fill
  }));

  const SIZE = {
    caption: "text-caption",
    "body-sm": "text-body-sm",
    body: "text-body",
    "body-lg": "text-body-lg",
    h4: "text-h4 leading-h4",
    h3: "text-h3 leading-h3"
  };
  const WEIGHT = { normal: "font-normal", medium: "font-medium", semibold: "font-semibold" };
  const ALIGN = { start: "text-start", center: "text-center", end: "text-end" };
</script>

<textarea
  {...trace}
  {value}
  oninput={(event) => oninput?.(event.currentTarget.value)}
  {placeholder}
  aria-label={label}
  rows="1"
  class={cn(
    "text-ink-primary placeholder:text-ink-muted w-full resize-none border-none bg-transparent p-0 outline-none [field-sizing:content]",
    SIZE[size],
    WEIGHT[weight],
    ALIGN[align],
    fill && "h-full [field-sizing:fixed]"
  )}
></textarea>
