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
  import { VARIABLE } from "$app-views/categories/spreadsheet-editor/procedures/selection-kinds";
  import { variableSignal } from "$app-views/categories/spreadsheet-editor/procedures/selecting";
  import { displayOf, parseTyped } from "$app-views/categories/spreadsheet-editor/procedures/values";
  import { loadsTheVariables } from "$app-views/categories/spreadsheet-editor/procedures/effects/loads-the-variables.svelte";
  import { seedsFromTheRecord } from "$app-views/categories/spreadsheet-editor/procedures/effects/seeds-from-the-record.svelte";
  import {
    removesTheVariable,
    savesTheVariable
  } from "$app-views/categories/spreadsheet-editor/procedures/editing-variables";
  import {
    variableRegister,
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
  const register = variableRegister();

  loadsTheVariables(register);

  const chosen = $derived(view.selection?.kind === VARIABLE ? view.selection.id : undefined);

  const held = $derived(
    chosen === undefined
      ? undefined
      : register.records.find((variable) => variable.name.toLowerCase() === chosen.toLowerCase())
  );

  let name = $state("");
  let type = $state<VariableType>("any");
  let literal = $state("");
  let refusal = $state<string | undefined>(undefined);
  seedsFromTheRecord(
    () => held,
    (record) => {
      name = record.name;
      type = record.type;
      literal = displayOf(record.value);
      refusal = undefined;
    }
  );

  const opened = (wanted: string) => {
    const signal = variableSignal(wanted);
    view.inspect(signal.key, signal.selection);
  };

  const commit = () => {
    const record = held;
    if (record === undefined) return;
    void savesTheVariable({
      register,
      record,
      name,
      type,
      literal,
      refused: (reason) => {
        refusal = reason;
      },
      opened
    });
  };

  const retype = (next: string) => {
    type = next as VariableType;
    commit();
  };

  const remove = () => {
    const record = held;
    if (record === undefined) return;
    void removesTheVariable(register, record.name, () => view.clear());
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
          onenter={commit}
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
          onenter={commit}
        />
      </PanelControlRow>
    </PanelControlGroup>

    {#if refusal}
      <PanelNote>{refusal}</PanelNote>
    {/if}

    <div class="actions">
      <PanelButton label="Delete" icon={Trash2} tone="danger" onclick={remove} />
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
