<script lang="ts">
  import { cn } from "$vendored-components/utils";
  import { traceNode } from "$development-components/trace.svelte";

  /**
   * One colour, named, in a listing of colours.
   *
   * A theme's "Accent 1", a chart series' fill, the key to a legend. The colour
   * here is content: it comes from whatever the caller is describing, and this
   * vocabulary has no opinion about what it means.
   *
   * **Not `PanelChip`.** A chip is a word with a tone, and the tone comes from
   * the role vocabulary — success, attention, intelligence — a closed set where
   * every entry means something. A theme colour called "Paper" belongs to no
   * such set. Rendering it as a chip either drops the actual colour or invents a
   * role for it, and both are lies about a value the deck owns.
   *
   * **The name is the swatch and the colour is beside it.** A row of coloured
   * squares says nothing at all to a reader who cannot see them, and to everyone
   * else it says only that four colours exist rather than which is which — the
   * names are what make the list answerable. So the square is `aria-hidden`, the
   * text is required, and there is no prop that turns the words off.
   *
   * **A square, where `PanelColor`'s swatches are circles.** Those are radio
   * targets and are shaped like targets. This is a sample of material, and it is
   * drawn as one so a listing is never mistaken for a control that sets a value.
   *
   * Always a child of `PanelSwatches`, which owns whether the list wraps or
   * runs down the column.
   */
  let {
    name,
    color,
    value,
    selected = false,
    onselect
  }: {
    /** What the colour is called here — "Accent 1", "Paper", "Revenue". */
    name: string;
    /**
     * Anything `background` accepts. Prefer `var(--token-…)` where the colour
     * has a token: a literal is a value that will not follow a theme change.
     */
    color: string;
    /**
     * The colour written out — a token name, a hex code. Set in mono because it
     * is a value someone retypes, and proportional type hides a wrong character.
     */
    value?: string;
    /** Whether this is the one the panel is currently about. */
    selected?: boolean;
    /**
     * Opens the lens for this colour. Absent for a listing that is only a
     * listing, which most of them are — a swatch never sets a value, so a
     * selectable one is a way in rather than a choice.
     */
    onselect?: () => void;
  } = $props();

  const trace = traceNode("PanelSwatch", () => ({ name, color, value, selected }));
</script>

{#snippet body()}
  <span
    style:background={color}
    class="border-border-subtle rounded-control size-4 shrink-0 border"
    aria-hidden="true"
  ></span>
  <!-- Wraps rather than truncates: a clipped colour name names nothing. -->
  <span class={cn("text-caption min-w-0", selected ? "text-active-text" : "text-ink-secondary")}>
    {name}
  </span>
  {#if value}
    <span class="text-mono text-ink-muted ms-auto shrink-0 ps-2 font-mono tabular-nums">
      {value}
    </span>
  {/if}
{/snippet}

<li {...trace} class="list-none">
  <!--
    Branched rather than a computed tag: a swatch that opens nothing must not be
    in the tab order, and Svelte only checks the accessibility of a tag it sees.
  -->
  {#if onselect}
    <button
      type="button"
      onclick={onselect}
      aria-current={selected ? "true" : undefined}
      class={cn(
        /* The negative margin lets the hover fill reach into the panel gutter
           while the text stays on it. */
        "rounded-control -mx-1 flex w-full cursor-pointer items-center gap-2 px-1 py-0.5 text-start",
        selected ? "bg-active-surface" : "hover:bg-surface-panel-hover"
      )}
    >
      {@render body()}
    </button>
  {:else}
    <span class="flex w-full items-center gap-2 py-0.5">{@render body()}</span>
  {/if}
</li>
