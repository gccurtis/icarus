<script lang="ts">
  import FileText from "@lucide/svelte/icons/file-text";
  import Presentation from "@lucide/svelte/icons/presentation";
  import RectangleHorizontal from "@lucide/svelte/icons/rectangle-horizontal";
  import TableIcon from "@lucide/svelte/icons/table";

  import { Panel, PanelRow, PanelSection } from "$authored-components/panel";
  import { recentlyUpdatedTemplates, recentlyUsedTemplates } from "$capabilities/library";
  import { viewState } from "$model/client/view-state";

  const view = viewState();

  /**
   * What has changed lately, and what has been used lately.
   *
   * `docs/screen-panel-views/context/library/recent-templates.md` is the
   * specification. Two sections rather than one "recent" list, because a template
   * you edited yesterday and a template you used yesterday are different signals
   * and merging them loses both.
   *
   * Nothing counts uses. *Recently used* is a reverse query over the resources a
   * template made, so a template that has never been used simply never appears —
   * it is not a zero.
   */
  const updated = $derived(recentlyUpdatedTemplates().current);
  const used = $derived(recentlyUsedTemplates().current);

  const MAKES = {
    Document: FileText,
    "Slide deck": Presentation,
    Slide: RectangleHorizontal,
    Spreadsheet: TableIcon
  };

  const inspect = (id: string) =>
    view.inspect("library.template", { kind: "template", id });
</script>

<Panel title="Recent">
  <PanelSection title="Recently updated" count={updated.length} flush>
    {#each updated as row (row.id)}
      <PanelRow
        title={row.name}
        sub={row.makes}
        meta={row.updated}
        icon={MAKES[row.makes]}
        onselect={() => inspect(row.id)}
      />
    {/each}
  </PanelSection>

  <PanelSection title="Recently used" count={used.length} flush>
    {#each used as row (row.id)}
      <PanelRow
        title={row.name}
        sub={row.makes}
        meta={row.lastUsed}
        icon={MAKES[row.makes]}
        onselect={() => inspect(row.id)}
      />
    {/each}
  </PanelSection>
</Panel>
