<script lang="ts">
  import {
    Panel,
    PanelBanner,
    PanelChip,
    PanelEmpty,
    PanelField,
    PanelFields,
    PanelSection,
    PanelSkeleton
  } from "$authored-components/panel";
  import { projectOverview } from "$app-views/categories/project-overview/procedures/read-overview";

  const titleCase = (value: string): string =>
    value.length === 0 ? value : `${value[0].toLocaleUpperCase()}${value.slice(1)}`;

  const calendarDate = (at: number): string =>
    new Date(at).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
</script>

<!--
  Deliberately sparse. The centre already names and describes the project, shows
  its roster, counts and filters its resources, and carries mentions plus recent
  activity. Repeating those here would make this flank a smaller copy of the
  board. These are the three stable administrative facts the board does not say.
-->
<Panel title="Overview">
  <div class="pt-1">
    {#await projectOverview()}
      <PanelSkeleton shape="fields" count={3} />
    {:then overview}
      {#if overview === null}
        <PanelEmpty title="Project metadata could not be resolved." />
      {:else}
        <PanelSection title="Project" flush>
          <div class="border-border-subtle bg-surface-panel-hover border-y py-2.5">
          <PanelFields proportional>
            <PanelField label="Status" hierarchy>
              <PanelChip tone={overview.status === "active" ? "success" : "inactive"}>
                {titleCase(overview.status)}
              </PanelChip>
            </PanelField>
            <PanelField label="Your role" hierarchy>{titleCase(overview.viewerRole)}</PanelField>
            <PanelField label="Created" mono stacked hierarchy>{calendarDate(overview.createdAt)}</PanelField>
          </PanelFields>
          </div>
        </PanelSection>
      {/if}
    {:catch error}
      <PanelBanner title="Project overview unavailable" tone="attention">
        {error instanceof Error ? error.message : String(error)}
      </PanelBanner>
    {/await}
  </div>
</Panel>
