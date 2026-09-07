<script lang="ts">
  import Trash2 from "@lucide/svelte/icons/trash-2";

  import {
    Panel,
    PanelButton,
    PanelControlGroup,
    PanelControlRow,
    PanelEmpty,
    PanelInput,
    PanelNote,
    PanelSelect
  } from "$authored-components/panel";
  import { VARIABLE, variableSignal } from "$app-views/categories/spreadsheet-editor/procedures/selecting";
  import { displayOf, parseTyped } from "$app-views/categories/spreadsheet-editor/procedures/values";
  import {
    loadVariables,
    removeVariable,
    saveVariable,
    variables,
    variablesLoaded,
    type VariableRecord
  } from "$app-views/categories/spreadsheet-editor/procedures/variables.svelte";
  import { workspaceState } from "$model/client/workspace-state";

  type VariableType = VariableRecord["type"];

  const TYPES: readonly { value: VariableType; label: string }[] = [
    { value: "any", label: "Any" },
    { value: "number", label: "Number" },
    { value: "text", label: "Text" },
    { value: "logic", label: "Logic" },
    { value: "date", label: "Date" },
    { value: "list", label: "List" },
    { value: "record", label: "Record" },
    { value: "table", label: "Table" },
    { value: "reference", label: "Reference" }
  ];

  const view = workspaceState();

  $effect(() => {
    if (!variablesLoaded()) void loadVariables();
  });

  const chosen = $derived(view.selection?.kind === VARIABLE ? view.selection.id : undefined);

  const held = $derived(
    chosen === undefined
      ? undefined
      : variables().find((variable) => variable.name.toLowerCase() === chosen.toLowerCase())
  );

  let name = $state("");
  let type = $state<VariableType>("any");
  let literal = $state("");
  let refusal = $state<string | undefined>(undefined);
  let seeded = $state<string | undefined>(undefined);

  $effect(() => {
    const record = held;
    if (record === undefined || seeded === record.id) return;
    seeded = record.id;
    name = record.name;
    type = record.type;
    literal = displayOf(record.value);
    refusal = undefined;
  });

  const commit = async (): Promise<void> => {
    const record = held;
    if (record === undefined) return;
    const wanted = name.trim();
    const parsed = parseTyped(literal);
    const answer = await saveVariable({
      name: wanted,
      value: parsed.kind === "value" ? parsed.value : { kind: "empty" },
      type
    });
    if (!answer.saved) {
      refusal = answer.reason;
      return;
    }
    refusal = undefined;
    if (wanted === record.name) return;
    if (wanted.toLowerCase() !== record.name.toLowerCase()) await removeVariable(record.name);
    const signal = variableSignal(wanted);
    view.inspect(signal.key, signal.selection);
  };

  const retype = (next: string) => {
    type = next as VariableType;
    void commit();
  };

  const remove = async (): Promise<void> => {
    const record = held;
    if (record === undefined) return;
    await removeVariable(record.name);
    view.clear();
  };
</script>

<Panel title="Variable">
  {#if held}
    <PanelControlGroup>
      <PanelControlRow label="Name">
        <PanelInput
          label="Name"
          placeholder="perMinuteRate"
          flush
          bind:value={name}
          onenter={() => void commit()}
        />
      </PanelControlRow>
      <PanelControlRow label="Type">
        <PanelSelect label="Type" value={type} options={TYPES} onchange={retype} />
      </PanelControlRow>
      <PanelControlRow label="Value">
        <PanelInput
          label="Value"
          placeholder="3.10"
          mono
          flush
          bind:value={literal}
          onenter={() => void commit()}
        />
      </PanelControlRow>
    </PanelControlGroup>

    {#if refusal}
      <PanelNote>{refusal}</PanelNote>
    {/if}

    <div class="actions">
      <PanelButton label="Delete" icon={Trash2} tone="danger" onclick={() => void remove()} />
    </div>
  {:else}
    <PanelEmpty title="Pick a variable in the Variables panel" />
  {/if}
</Panel>

<style>
  .actions {
    display: flex;
    padding: calc(var(--token-spacing-unit) * 2) calc(var(--token-spacing-unit) * 3);
  }
</style>
