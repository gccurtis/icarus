<script lang="ts">
  import { OverlayModal } from "$authored-components/overlay";
  import {
    PanelEditableText,
    PanelField,
    PanelFields
  } from "$authored-components/panel";
  import {
    ScreenCell,
    ScreenEmpty,
    ScreenFilters,
    ScreenGroup,
    ScreenRow,
    ScreenTable
  } from "$authored-components/screen";
  import { Textarea } from "$vendored-components/textarea";
  import { ToggleGroup, ToggleGroupItem } from "$vendored-components/toggle-group";
  import { read } from "$capabilities/store/index.remote";
  import { BUILTINS } from "$modals/builtins";

  /**
   * Writing an expression against everything the project can refer to.
   *
   * A modal rather than a panel: an expression has parts that must agree, and a
   * 300px column is not where that happens.
   */
  let { open = $bindable(false) }: { open?: boolean } = $props();

  let expression = $state("");
  let search = $state("");
  let name = $state("");
  /** One axis. The function categories are bands in the list, not chips here. */
  let kinds = $state<string[]>([]);

  type Entry = {
    id: string;
    name: string;
    right: string;
    group: string;
    kind: "variable" | "function";
    description: string;
  };

  const answer = $derived(read({ path: "variables" }));
  const rows = $derived(
    answer.current?.kind === "table" && answer.current.table === "variables"
      ? answer.current.rows
      : []
  );

  const entries = $derived<Entry[]>([
    ...rows.map((variable) => ({
      id: variable._id,
      name: variable.name,
      right: variable.value.kind,
      group: "Variables",
      kind: "variable" as const,
      description: ""
    })),
    ...BUILTINS.map((builtin) => ({
      id: builtin.id,
      name: builtin.signature,
      right: "function",
      group: builtin.category,
      kind: "function" as const,
      description: builtin.description
    }))
  ]);

  const matching = $derived(
    entries
      .filter((entry) => kinds.length === 0 || kinds.includes(entry.kind))
      .filter((entry) => {
        const needle = search.trim().toLowerCase();
        return (
          needle === "" ||
          entry.name.toLowerCase().includes(needle) ||
          entry.description.toLowerCase().includes(needle)
        );
      })
  );

  const groups = $derived([...new Set(matching.map((entry) => entry.group))]);

  let selected = $state<string | undefined>(undefined);
  let expanded = $state<string | undefined>(undefined);

  /** Selecting inserts. */
  const insert = (entry: Entry) => {
    selected = entry.id;
    expression = expression === "" ? entry.name : `${expression}${entry.name}`;
  };

  const taken = $derived(new Set(rows.map((variable) => variable.name.toLowerCase())));
  const conflict = $derived(name.trim() !== "" && taken.has(name.trim().toLowerCase()));
</script>

<OverlayModal
  bind:open
  title="Function Builder"
  description="Write an expression against everything this project can refer to."
  confirm={name.trim() === "" ? "Copy & Close" : "Save & Close"}
  blocked={conflict ? "That name is already taken" : undefined}
  unsaved={expression.trim() !== ""}
  width="wide"
  onconfirm={() => {}}
  oncancel={() => {
    expression = "";
    name = "";
  }}
>
  <div class="grid gap-3 px-3">
    <!-- Spans both tracks, and grows with what is typed. -->
    <PanelFields>
      <PanelField label="Expression" stacked>
        <Textarea
          bind:value={expression}
          rows={3}
          class="font-mono text-mono"
          placeholder="SUM(outageEvents.customerMinutes) / COUNT(substations)"
        />
      </PanelField>
    </PanelFields>

    <ScreenFilters
      placeholder="Search variables and functions"
      matched={matching.length}
      total={entries.length}
      bind:value={search}
    >
      <ToggleGroup type="multiple" bind:value={kinds} variant="outline" size="sm">
        <ToggleGroupItem value="variable">Variables</ToggleGroupItem>
        <ToggleGroupItem value="function">Functions</ToggleGroupItem>
      </ToggleGroup>
    </ScreenFilters>

    {#if matching.length === 0}
      <ScreenEmpty kind="no-matches" title="Nothing matches" onclear={() => (search = "")}>
        No variable or function has that in its name or its description.
      </ScreenEmpty>
    {:else}
      <!-- One table across both columns: two would drift apart on row height. -->
      <ScreenTable columns={["Name", "Value", "What it does"]}>
        {#each groups as group (group)}
          <ScreenGroup
            label={group}
            count={String(matching.filter((entry) => entry.group === group).length)}
          >
            {#each matching.filter((entry) => entry.group === group) as entry (entry.id)}
              <ScreenRow selected={selected === entry.id}>
                <ScreenCell name={entry.name} onselect={() => insert(entry)} />
                <ScreenCell num>{entry.right}</ScreenCell>
                <ScreenCell>
                  <button
                    type="button"
                    class="text-body-sm text-ink-secondary text-start"
                    class:line-clamp-2={expanded !== entry.id}
                    onclick={() => (expanded = expanded === entry.id ? undefined : entry.id)}
                  >
                    {entry.description === ""
                      ? "No description — a project variable cannot carry one yet."
                      : entry.description}
                  </button>
                </ScreenCell>
              </ScreenRow>
            {/each}
          </ScreenGroup>
        {/each}
      </ScreenTable>
    {/if}

    <!-- In the body, not the footer: the name decides the confirm label. -->
    <PanelFields>
      <PanelField label="Name" stacked>
        <PanelEditableText
          label="Name"
          value={name}
          placeholder="Leave empty to copy rather than save"
          onchange={(next) => (name = next)}
        />
      </PanelField>
    </PanelFields>
  </div>
</OverlayModal>
