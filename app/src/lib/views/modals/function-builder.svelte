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
  import { builtins } from "$capabilities/formula";
  import { variables } from "$capabilities/project";

  /**
   * Writing an expression against everything the project can refer to, with the
   * whole vocabulary in front of you.
   *
   * `docs/screen-panel-views/modals/function-builder.md` is the specification. It
   * is a modal rather than a panel because an expression has to be *constructed* —
   * it has parts that must agree, and a 300px column is not where that happens.
   *
   * **The tracks are 2fr/3fr, not 1fr/3fr.** A quarter of 672px is 160px, and the
   * identity column carries a name *and* a value: `hardeningBudget` beside
   * `46,000,000` does not fit in 160px.
   */
  let { open = $bindable(false) }: { open?: boolean } = $props();

  let expression = $state("");
  let search = $state("");
  let name = $state("");
  /**
   * Three chips on one axis. Six — Functions, Variables, List/Range, Text, Maths,
   * Statistics — are two axes wearing one row: a person choosing Variables and
   * Maths together has asked for nothing and the control cannot say so. The
   * function categories are bands in the list below instead.
   */
  let kinds = $state<string[]>([]);

  type Entry = {
    id: string;
    name: string;
    right: string;
    group: string;
    kind: "variable" | "function";
    description: string;
  };

  const entries = $derived<Entry[]>([
    ...variables().current.map((variable) => ({
      id: variable.id,
      name: variable.name,
      right: variable.preview ?? variable.value,
      group: "Variables",
      kind: "variable" as const,
      description: ""
    })),
    ...builtins().current.map((builtin) => ({
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

  /** Selecting inserts at the caret. Inserting is what the modal exists for. */
  const insert = (entry: Entry) => {
    selected = entry.id;
    expression = expression === "" ? entry.name : `${expression}${entry.name}`;
  };

  const taken = $derived(
    new Set(variables().current.map((variable) => variable.name.toLowerCase()))
  );
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
    <!--
      The expression spans both tracks because it is the subject; the two result
      columns are the reference beneath it. It grows with what is typed, because
      an expression that has outgrown its box is one you can no longer check.
    -->
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
      <!--
        One table across both columns, so the seam between the list and the
        descriptions is the table's rather than a border drawn twice. Two tables
        side by side would have their own row heights and drift apart the moment a
        description expanded.
      -->
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

    <!--
      The name is the last row of the body rather than part of the frame's footer:
      `OverlayModal`'s footer takes a confirm label and nothing else, and the name
      is what decides which label that is.
    -->
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
