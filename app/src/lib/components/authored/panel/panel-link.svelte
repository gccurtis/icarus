<script lang="ts">
  import { Button } from "$vendored-components/button";
  import { cn } from "$vendored-components/utils";
  import { traceNode } from "$development-components/trace.svelte";

  /**
   * A name inside a sentence or a field that opens what it names.
   *
   * Every "who" in this application is one of these — an actor is inspectable
   * from wherever it is named, so a provenance field is a link and not a string.
   * The same shape carries a resource named inside a lens for another one.
   *
   * `simple-components/button` in its `link` variant: a button rather than an
   * anchor, because it changes what the inspector is looking at and nothing
   * about it is a navigation. There is no URL for it to have.
   *
   * **It inherits the type it sits in.** A link appears mid-sentence and inside
   * fields of three different sizes, so it takes its size, weight and leading
   * from its surroundings rather than carrying its own — a control that reset
   * the type in the middle of a sentence would be visible as a seam.
   *
   * **`title` is what the label could not say.** A link inside a panel is
   * frequently a truncated name, or a name whose kind is not obvious from the
   * word — three people and a connector all read as capitalised nouns. Hover
   * text is where the rest of it goes.
   */
  let {
    label,
    title,
    lines,
    onselect
  }: {
    label: string;
    /** Hover text: the full name, the kind, or where this leads. */
    title?: string;
    /** Bound unusually long labels while keeping the complete name available on hover. */
    lines?: 1 | 2 | 3;
    onselect: () => void;
  } = $props();

  // The marker is forwarded through `Button` onto the element it renders.
  const trace = traceNode("PanelLink", () => ({ label, title, lines }));

  const CLAMP: Record<NonNullable<typeof lines>, string> = {
    1: "truncate",
    2: "line-clamp-2",
    3: "line-clamp-3"
  };
</script>

<Button
  {...trace}
  variant="link"
  title={title ?? (lines === undefined ? undefined : label)}
  onclick={onselect}
  class="text-interactive-text h-auto max-w-full min-w-0 justify-start p-0 text-start text-[length:inherit] leading-[inherit] font-[inherit] whitespace-normal"
>
  <span class={cn("min-w-0", lines === undefined ? "break-words" : CLAMP[lines])}>{label}</span>
</Button>
