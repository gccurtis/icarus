<script lang="ts">
  import Ban from "@lucide/svelte/icons/ban";
  import Cpu from "@lucide/svelte/icons/cpu";
  import ShieldCheck from "@lucide/svelte/icons/shield-check";

  import {
    Panel,
    PanelNote,
    PanelRow,
    PanelSearch,
    PanelSection
  } from "$components/authored/panel";
  import { modelBindingOf, toolsFor, type ToolPermission } from "$capabilities/agents";
  import { viewState } from "$model/client/view-state";

  const view = viewState();

  /**
   * What this agent may do, and which model runs it.
   *
   * `docs/screen-panel-views/context/agents/tools.md` is the specification.
   * Permissions are split into two lists rather than checkboxed, so what is
   * denied is as visible as what is granted — a task that failed because a tool
   * was not permitted is diagnosed by reading the second list.
   *
   * **There is no Web toggle.** `web.search` is a tool like any other, and a
   * persona either has it or does not.
   *
   * **The model is a binding name.** Providers, credentials and deployment setup
   * belong outside the project workbench entirely, which is why the section
   * holds one row and a sentence rather than a settings form.
   */
  let { personaId = "grid-analyst" }: { personaId?: string } = $props();

  const catalogue = $derived(toolsFor(personaId).current);
  const binding = $derived(modelBindingOf(personaId).current);

  let search = $state("");

  const shown = $derived(
    catalogue.filter((tool: ToolPermission) =>
      tool.id.toLowerCase().includes(search.trim().toLowerCase())
    )
  );

  const allowed = $derived(shown.filter((tool: ToolPermission) => tool.allowed));
  const denied = $derived(shown.filter((tool: ToolPermission) => !tool.allowed));

  const openTool = (id: string) => view.inspect("agents.tool", { kind: "tool", id });
</script>

<Panel title="Tools">
  <!--
    The field contains both permission lists and nothing else. The model is not a
    tool, and a search matching no tool must not take the binding off the screen
    with it.
  -->
  <PanelSearch
    placeholder="Search tools"
    matched={shown.length}
    total={catalogue.length}
    bind:value={search}
    flush
  >
    <PanelSection title="Allowed" count={allowed.length} flush>
      {#each allowed as tool (tool.id)}
        <PanelRow
          title={tool.id}
          sub={tool.does}
          icon={ShieldCheck}
          tone="success"
          onselect={() => openTool(tool.id)}
        />
      {/each}
    </PanelSection>

    <PanelSection title="Not allowed" count={denied.length} flush>
      {#each denied as tool (tool.id)}
        <PanelRow title={tool.id} sub={tool.does} icon={Ban} onselect={() => openTool(tool.id)} />
      {/each}
    </PanelSection>
  </PanelSearch>

  <PanelSection title="Model" flush>
    <PanelRow
      title={binding.name}
      sub={binding.isDefault ? "The default binding" : "A binding, chosen for this persona"}
      icon={Cpu}
      onselect={() => view.inspect("agents.model", { kind: "model", id: binding.name })}
    />
    <PanelNote>
      A binding name, not a credential. Providers, credentials and deployment
      setup never appear in the project workbench.
    </PanelNote>
  </PanelSection>
</Panel>
