<script lang="ts">
  import Type from "@lucide/svelte/icons/type";

  import {
    Panel,
    PanelField,
    PanelFields,
    PanelRow,
    PanelSection
  } from "$components/authored/panel";
  import { pageSetupFor, stylesIn } from "$capabilities/library";

  /**
   * Styles and page setup for the template body.
   *
   * `docs/screen-panel-views/context/library/authoring-design.md` is the
   * specification. The ordinary editor's Styles and Page views, collapsed into
   * one because a template is usually short and the two together fit. That is a
   * density decision that will stop suiting a long template.
   *
   * A style row is not a target: there is no lens for one, and a row that looks
   * pressable and opens nothing is worse than a row that plainly reports.
   */
  let { templateId = "tp-filing" }: { templateId?: string } = $props();

  const styles = $derived(stylesIn(templateId).current);
  const page = $derived(pageSetupFor(templateId).current);
</script>

<Panel title="Design">
  <PanelSection title="Styles" count={styles.length} flush>
    {#each styles as style (style.id)}
      <PanelRow title={style.name} sub={style.detail} icon={Type} />
    {/each}
  </PanelSection>

  <!-- Flush, because `PanelFields` carries the panel's own gutter. -->
  <PanelSection title="Page" flush>
    <PanelFields>
      <PanelField label="Paper">{page.paper}</PanelField>
      <PanelField label="Orientation">{page.orientation}</PanelField>
      <PanelField label="Gutters">{page.gutters}</PanelField>
    </PanelFields>
  </PanelSection>
</Panel>
