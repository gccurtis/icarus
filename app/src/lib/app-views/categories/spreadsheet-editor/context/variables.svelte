<script lang="ts">
  import Plus from "@lucide/svelte/icons/plus";

  import { Panel, PanelButton, PanelEmpty, PanelRow, PanelSearch } from "$authored-components/panel";
  import { VARIABLE, variableSignal } from "$app-views/categories/spreadsheet-editor/procedures/selecting";
  import { displayOf } from "$app-views/categories/spreadsheet-editor/procedures/values";
  import { loadsTheVariables } from "$app-views/categories/spreadsheet-editor/procedures/effects/loads-the-variables.svelte";
  import {
    saveVariable,
    variables,
    type VariableRecord
  } from "$app-views/categories/spreadsheet-editor/procedures/variables.svelte";
  import { workspaceState } from "$model/client/workspace-state";

  const view = workspaceState();

  loadsTheVariables(() => view.project);

  let filter = $state("");

  const held = $derived(variables(view.project));

  const shown = $derived(
    held.filter((variable) => variable.name.toLowerCase().includes(filter.trim().toLowerCase()))
  );

  const chosen = $derived(
    view.selection?.kind === VARIABLE ? view.selection.id.toLowerCase() : undefined
  );

  const open = (name: string) => {
    const signal = variableSignal(name);
    view.inspect(signal.key, signal.selection);
  };

  const create = async (): Promise<void> => {
    const taken = new Set(held.map((variable) => variable.name.toLowerCase()));
    let index = 1;
    while (taken.has(`variable${index}`)) index += 1;
    const wanted = `variable${index}`;
    const answer = await saveVariable(view.project, { name: wanted, value: { kind: "empty" }, type: "any" });
    if (answer.saved) open(wanted);
  };

  const sub = (variable: VariableRecord): string =>
    `${variable.type} · ${displayOf(variable.value) || "empty"}`;
</script>

<Panel title="Variables">
  <div class="actions">
    <PanelButton label="New variable" icon={Plus} tone="primary" onclick={() => void create()} />
  </div>

  {#if held.length === 0}
    <PanelEmpty title="This project has no variables yet" />
  {:else}
    <PanelSearch
      placeholder="Filter variables…"
      bind:value={filter}
      matched={filter === "" ? undefined : shown.length}
      total={held.length}
      empty="No variable has that name."
    >
      {#each shown as variable (variable.id)}
        <PanelRow
          title={variable.name}
          sub={sub(variable)}
          selected={chosen === variable.name.toLowerCase()}
          onselect={() => open(variable.name)}
        />
      {/each}
    </PanelSearch>
  {/if}
</Panel>

<style>
  .actions {
    display: flex;
    padding: calc(var(--token-spacing-unit) * 2) calc(var(--token-spacing-unit) * 3) 0;
  }
</style>
