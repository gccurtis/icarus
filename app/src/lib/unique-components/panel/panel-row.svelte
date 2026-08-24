<script lang="ts">
  import type { Component, Snippet } from "svelte";

  import { cn } from "$lib/simple-components/utils";
  import { traceNode } from "$lib/trace/trace.svelte";

  /**
   * A line in a list: an icon, what it is, what qualifies it, and when.
   *
   * The single most repeated shape in the application — a resource, a mention, a
   * task, a saved scope and a tool permission are all this. Which is why it is
   * one component: the density of a list row is a decision made once.
   *
   * **Selectable rows are buttons; the rest are not.** A row that does nothing
   * must not be in the tab order and must not offer a hover fill, because both
   * promise a target. `onselect` is what decides, so the promise and the
   * behaviour cannot disagree.
   *
   * **The subtitle is the qualifier, not a second title.** It is what tells two
   * rows with the same name apart — a state, a location, a count — and it
   * truncates before the title does.
   */
  let {
    title,
    sub,
    meta,
    icon: Icon,
    tone = "default",
    titleTone,
    selected = false,
    indent = false,
    depth = 0,
    onselect,
    control,
    children
  }: {
    title: string;
    /** What qualifies it: a state, a location, a quoted fragment. */
    sub?: string;
    /** The right-hand column: a time, a count. Never a control. */
    meta?: string;
    icon?: Component<{ size?: number | string; "aria-hidden"?: boolean | "true" | "false" }>;
    /** Colours the icon when the row reports a state rather than a thing. */
    tone?: "default" | "success" | "danger" | "attention" | "active" | "intelligence";
    /**
     * Colours the title as well, for a row whose *subject* carries the state —
     * a failed task, a name that is gone. Absent by default, because on most
     * rows the state belongs to the row's condition rather than to its name, and
     * a coloured title there reads as a second, competing claim.
     */
    titleTone?: "default" | "success" | "danger" | "attention" | "active" | "intelligence";
    /** Whether this is the row the panel is currently about. */
    selected?: boolean;
    /** One level in, for a child of the row above it. `depth={1}` says the same. */
    indent?: boolean;
    /**
     * How many levels in, for a list nested more than once — a document outline
     * by heading level, a lattice, a question and its children.
     *
     * `indent` is a boolean, so an H3 would sit exactly where an H2 does and the
     * outline would read as two levels however deep it ran. Capped at three: a
     * fourth step in a 300px column leaves the title nowhere to be, and a tree
     * that deep wants the centre rather than a flank.
     */
    depth?: 0 | 1 | 2 | 3;
    onselect?: () => void;
    /**
     * A control at the row's end: a switch, a remove, an overflow menu.
     *
     * Its presence changes what the row *is*. A row with an `onselect` and
     * nothing else is a button, and a button cannot hold another button — so a
     * row with a control becomes a container, and the title inside it becomes
     * the button instead. `ScreenDecision` solved the same problem the same way.
     *
     * `meta` is a value and this is an action; a row may carry both, and the
     * control is always last.
     */
    control?: Snippet;
    /** Replaces the title line, for a row that needs marked-up content in it. */
    children?: Snippet;
  } = $props();

  const trace = traceNode("PanelRow", () => ({
    title,
    sub,
    meta,
    tone,
    titleTone,
    selected,
    indent,
    depth
  }));

  /**
   * One step per level, off the panel's own gutter. Four values rather than a
   * computed `padding-inline-start` because Tailwind cannot see a class it did
   * not read in the source, and an arithmetic style attribute here would put a
   * dimension outside the token scale.
   */
  const INDENT = ["", "ps-8", "ps-12", "ps-16"] as const;

  const ICON_TONE: Record<NonNullable<typeof tone>, string> = {
    default: "text-ink-muted",
    success: "text-success-text",
    danger: "text-danger-text",
    attention: "text-attention-text",
    active: "text-active-text",
    intelligence: "text-intelligence-text"
  };

  /** Same roles, at title contrast: an untoned title is the panel's ordinary ink. */
  const TITLE_TONE: Record<NonNullable<typeof tone>, string> = {
    default: "text-ink-primary",
    success: "text-success-text",
    danger: "text-danger-text",
    attention: "text-attention-text",
    active: "text-active-text",
    intelligence: "text-intelligence-text"
  };
</script>

<!--
  Three shapes, decided by what the row holds rather than by a prop that says so.
  A row that only opens something is a button. A row that only shows something is
  a `listitem`. A row that does both cannot be a button — a control inside one
  fires it too — so it becomes a container and the title takes the press.
-->
<svelte:element
  {...trace}
  this={onselect && !control ? "button" : "div"}
  role={onselect && !control ? undefined : "listitem"}
  type={onselect && !control ? "button" : undefined}
  aria-current={onselect && !control && selected ? "true" : undefined}
  onclick={onselect && !control ? onselect : undefined}
  class={cn(
    "flex w-full items-start gap-2 px-3 py-1.5 text-start",
    /* 24px is the floor for a pointer target; two lines of content clears it. */
    "min-h-6",
    /* `indent` is depth 1 by another name; whichever says more wins. */
    INDENT[Math.max(depth, indent ? 1 : 0) as 0 | 1 | 2 | 3],
    onselect && !control && "hover:bg-surface-panel-hover cursor-pointer",
    selected && "bg-active-surface"
  )}
>
  {#if Icon}
    <span class={cn("mt-0.5 flex shrink-0", selected ? "text-active-text" : ICON_TONE[tone])}>
      <Icon size={14} aria-hidden="true" />
    </span>
  {/if}

  <span class="flex min-w-0 flex-1 flex-col">
    {#if children}
      {@render children()}
    {:else if onselect && control}
      <!-- The press is on the title, because the row around it is holding a control. -->
      <button
        type="button"
        {title}
        aria-current={selected ? "true" : undefined}
        onclick={onselect}
        class={cn(
          "text-body-sm truncate text-start hover:underline",
          selected ? "text-active-text" : TITLE_TONE[titleTone ?? "default"]
        )}
      >
        {title}
      </button>
    {:else}
      <!-- Both lines truncate in a 300px panel, so both carry their own text. -->
      <span
        {title}
        class={cn(
          "text-body-sm truncate",
          selected ? "text-active-text" : TITLE_TONE[titleTone ?? "default"]
        )}
      >
        {title}
      </span>
    {/if}
    {#if sub}
      <span title={sub} class="text-caption text-ink-muted truncate">{sub}</span>
    {/if}
  </span>

  {#if meta}
    <span class="text-caption text-ink-muted shrink-0 tabular-nums">{meta}</span>
  {/if}

  {#if control}
    <span class="flex shrink-0 items-center">{@render control()}</span>
  {/if}
</svelte:element>
