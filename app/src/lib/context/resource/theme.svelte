<script lang="ts">
  import {
    Panel,
    PanelField,
    PanelFields,
    PanelNote,
    PanelRow,
    PanelSection
  } from "$lib/unique-components/panel";
  import { deckStyles, deckTheme } from "$mock-capabilities/resource";
  import { mockWorkbench } from "$mock-models/workbench.svelte";

  /**
   * Deck-wide colour, type and named styles — what every slide and every layout
   * inherits unless it overrides it.
   *
   * `docs/screen-panel-views/context/resource/theme.md` is the specification.
   *
   * A theme colour has a name and no role, so a swatch is drawn beside its name
   * and assigned to nothing. Named styles start collapsed: they are deck
   * typography, which qualifies the theme rather than being the reason anyone
   * opens this.
   */
  let { deckId = "r-board" }: { deckId?: string } = $props();

  const theme = $derived(deckTheme(deckId).current);
  const styles = $derived(deckStyles(deckId).current);
</script>

<Panel title="Theme">
  <PanelSection title="Theme">
    <PanelFields>
      <PanelField label="Background">{theme.backgroundKind} · {theme.backgroundColor}</PanelField>
      <PanelField label="Font">{theme.family}</PanelField>

      <PanelField label="Palette" stacked>
        <!--
          Every swatch carries its name. The colours have no roles, so the name is
          the only thing that tells two of them apart and colour is never the only
          channel.
        -->
        <ul class="m-0 flex flex-wrap gap-x-3 gap-y-1 p-0">
          {#each theme.colors as color (color.id)}
            <li class="flex list-none items-center gap-1">
              <span
                class="border-border-subtle rounded-control size-4 shrink-0 border"
                style="background-color: var({color.token})"
                aria-hidden="true"
              ></span>
              <span class="text-caption text-ink-secondary">{color.name}</span>
            </li>
          {/each}
        </ul>
      </PanelField>

      <PanelField label="Used by">
        {theme.usedBySlides} slides · {theme.usedByLayouts} layouts
      </PanelField>
    </PanelFields>
  </PanelSection>

  <PanelNote tone="gap">
    How many colours a theme has, and what each one is <em>for</em>, is undetermined.
    Nothing on a slide can ask for "the accent", so every use of one of these is a
    literal that will not follow a theme change.
  </PanelNote>

  <!--
    Typography as named styles rather than per-element overrides, the same
    principle the document editor keeps. Shut on arrival: it qualifies the theme.
  -->
  <PanelSection title="Named styles" count={styles.length} open={false} flush>
    {#each styles as style (style.id)}
      <PanelRow
        title={style.name}
        sub="{style.shorthand} · {style.usedByElements} elements"
        meta={style.styleKey}
        onselect={() =>
          mockWorkbench.inspect("resource.deck-style", { kind: "style", id: style.id })}
      />
    {/each}
  </PanelSection>
</Panel>
