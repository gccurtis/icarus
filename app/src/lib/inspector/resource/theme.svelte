<script lang="ts">
  import {
    Panel,
    PanelCrumbs,
    PanelField,
    PanelFields,
    PanelNote,
    PanelSection
  } from "$lib/unique-components/panel";
  import { deckRecord, deckTheme } from "$mock-capabilities/resource";
  import { mockWorkbench } from "$mock-models/workbench.svelte";

  /**
   * The deck's theme: one background, one type family, four named colours.
   *
   * `docs/screen-panel-views/inspector/resource/theme.md` is the specification.
   *
   * **Usage is the section that says what an edit costs.** One theme per deck and
   * everything that does not override it inherits it, so the counts of slides and
   * layouts are the price of any change above.
   *
   * **The swatches are painted from semantic tokens** carried on the colour
   * itself, which is why they are the same four values the rest of the product
   * uses rather than four literals kept in step by hand.
   */
  let { deckId = "r-board" }: { deckId?: string } = $props();

  const theme = $derived(deckTheme(deckId).current);
  const deck = $derived(deckRecord(deckId).current);

  const slides = $derived(theme.usedBySlides === 1 ? "1 slide" : `${theme.usedBySlides} slides`);
  const layouts = $derived(
    theme.usedByLayouts === 1 ? "1 layout" : `${theme.usedByLayouts} layouts`
  );
</script>

<Panel title="Theme">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: deck.title, key: "resource.deck" }, { label: "Theme" }]}
      onnavigate={(key: string) => mockWorkbench.inspect(key, { kind: "deck", id: deckId })}
    />
  {/snippet}

  <PanelSection title="Background">
    <PanelFields>
      <PanelField label="Kind">{theme.backgroundKind}</PanelField>
      <PanelField label="Color">{theme.backgroundColor}</PanelField>
    </PanelFields>
    <PanelNote tone="gap">
      Only Solid exists. Whether an image or a gradient background is a thing has
      not been decided, and the Kind field implies it is.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Colors" count={theme.colors.length}>
    <div class="swatches">
      {#each theme.colors as color (color.id)}
        <div class="swatch">
          <span
            class="chip border-border-subtle rounded-control border"
            style="background-color: var({color.token})"
          ></span>
          <span class="text-caption text-ink-secondary">{color.name}</span>
        </div>
      {/each}
    </div>
    <PanelNote tone="gap">
      A theme colour has a name and no role, so nothing on a slide can ask for the
      accent. Every use of one is a literal that will not follow a change here.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Font">
    <PanelFields>
      <PanelField label="Family">{theme.family}</PanelField>
    </PanelFields>
  </PanelSection>

  <PanelSection title="Usage" open={false}>
    <PanelNote>Applied to {slides} and {layouts}.</PanelNote>
  </PanelSection>
</Panel>

<style>
  /*
    A swatch is the only thing in the panel vocabulary-sized layout here that has
    to be drawn rather than written, so its dimensions live with it.
  */
  .swatches {
    display: flex;
    flex-wrap: wrap;
    gap: calc(var(--token-spacing-unit) * 2);
  }

  .swatch {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--token-spacing-unit);
  }

  .chip {
    display: block;
    width: calc(var(--token-spacing-unit) * 10);
    height: calc(var(--token-spacing-unit) * 5);
  }
</style>
