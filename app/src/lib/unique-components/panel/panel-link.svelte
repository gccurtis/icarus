<script lang="ts">
  import { Button } from "$lib/simple-components/button";
  import { traceNode } from "$lib/trace/trace.svelte";

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
   * **`title` is what the label could not say.** A link inside a 300px panel is
   * frequently a truncated name, or a name whose kind is not obvious from the
   * word — three people and a connector all read as capitalised nouns. Hover
   * text is where the rest of it goes.
   */
  let {
    label,
    title,
    onselect
  }: {
    label: string;
    /** Hover text: the full name, the kind, or where this leads. */
    title?: string;
    onselect: () => void;
  } = $props();

  // The marker is forwarded through `Button` onto the element it renders.
  const trace = traceNode("PanelLink", () => ({ label, title }));
</script>

<Button
  {...trace}
  variant="link"
  {title}
  onclick={onselect}
  class="text-interactive-text h-auto justify-start p-0 text-[length:inherit] leading-[inherit] font-[inherit] whitespace-normal"
>
  {label}
</Button>
