<script lang="ts">
  import {
    Panel,
    PanelCrumbs,
    PanelField,
    PanelFields,
    PanelNote,
    PanelSection,
    PanelToggle
  } from "$lib/unique-components/panel";
  import { persona, toolsFor, type ToolPermission } from "$mock-capabilities/agents";
  import { mockWorkbench } from "$mock-models/workbench.svelte";

  /**
   * One tool permission, and what granting it means.
   *
   * `docs/screen-panel-views/inspector/agents/tool.md` is the specification. The
   * lens exists for the toggle: a denial is a row in the catalogue rather than an
   * absence, so a tool that is not allowed is still selectable and still says
   * what allowing it would do.
   *
   * **The description is written for someone deciding whether to grant it**,
   * which is why a tool's reach is stated in the same breath: a retrieval tool is
   * bounded by what the persona can look up, so granting it is not granting
   * access to the project.
   */
  let {
    personaId = "grid-analyst",
    toolId = "lattice.retrieve"
  }: { personaId?: string; toolId?: string } = $props();

  const profile = $derived(persona(personaId).current);
  const catalogue = $derived(toolsFor(personaId).current);
  const tool = $derived(
    catalogue.find((entry: ToolPermission) => entry.id === toolId) ?? catalogue[0]
  );

  /** Held locally: the door is a read, and a switch that moved and changed
   * nothing would be worse than one that did not move. */
  let granted = $state<boolean | undefined>(undefined);

  const allowed = $derived(granted ?? tool.allowed);
</script>

<Panel title={tool.id}>
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[
        { label: profile.name, key: "agents.persona" },
        { label: "Tools" },
        { label: tool.id }
      ]}
      onnavigate={(key: string) =>
        mockWorkbench.inspect(key, { kind: "persona", id: personaId })}
    />
  {/snippet}

  <PanelSection title="Tool" flush>
    <PanelFields>
      <PanelField label="Name" mono>{tool.id}</PanelField>
      <PanelField label="Allowed">
        <PanelToggle
          label="{tool.id} allowed"
          checked={allowed}
          onchange={(next: boolean) => (granted = next)}
        />
      </PanelField>
    </PanelFields>
  </PanelSection>

  <PanelSection title="What it does" flush>
    <PanelFields>
      <PanelField label="Does" stacked>{tool.does}</PanelField>
    </PanelFields>
    <PanelNote>
      Bounded by what {profile.name} can look up. Granting a tool is not granting
      access to the project.
    </PanelNote>
    <PanelNote tone="gap">
      The catalogue has to carry these descriptions, and they have to be written
      for someone deciding whether to grant a permission rather than for someone
      calling the tool.
    </PanelNote>
  </PanelSection>
</Panel>
