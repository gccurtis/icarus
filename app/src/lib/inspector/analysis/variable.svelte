<script lang="ts">
  import MoveRight from "@lucide/svelte/icons/move-right";

  import {
    Panel,
    PanelActions,
    PanelButton,
    PanelCrumbs,
    PanelField,
    PanelFields,
    PanelNote,
    PanelRow,
    PanelSection,
    PanelSelect
  } from "$lib/unique-components/panel";
  import {
    analysis,
    previewOf,
    relationsFor,
    tablesIn,
    variable
  } from "$mock-capabilities/analysis";
  import { mockWorkbench } from "$mock-models/workbench.svelte";

  /**
   * A variable as the Analysis screen sees it: what is in it, how it lines up
   * with the others, and where to put it.
   *
   * `docs/screen-panel-views/inspector/analysis/variable.md` is the
   * specification. It drops the authoring detail a variable carries elsewhere —
   * lookup key, order — and adds the one thing only this screen cares about.
   *
   * **Rows are printed for tables and nothing else.** A value has no row count,
   * and a lens that prints one for it is inventing a shape.
   *
   * **Put on X and Put on Y act on a field, not on the variable.** Putting a
   * table on an axis is not meaningful, so a table picks a field first and a
   * value says what it is good for instead.
   */
  let {
    variableId = "v-1",
    analysisId = "r-minutes"
  }: { variableId?: string; analysisId?: string } = $props();

  const record = $derived(analysis(analysisId).current);
  const lens = $derived(variable(variableId).current);
  const relations = $derived(relationsFor(variableId).current);
  const tables = $derived(tablesIn(mockWorkbench.project.id).current);

  const isTable = $derived(lens.type === "table");
  const table = $derived(tables.find((one) => one.name === lens.name));

  /** Only a table has a prefix to show; asking for one anywhere else answers with another table's. */
  const preview = $derived(isTable ? previewOf(variableId).current : undefined);

  const FIELDS = $derived(
    (table?.fields ?? []).map((field) => ({ value: field.name, label: `${field.name} · ${field.type}` }))
  );

  let picked = $state<string | undefined>(undefined);
  let put = $state<string | undefined>(undefined);

  const field = $derived(picked ?? table?.fields[0]?.name ?? "");

  const place = (axis: "X" | "Y") => {
    put = `${lens.name}.${field} put on ${axis}.`;
  };

  const rows = (count: number) => count.toLocaleString("en-GB");

  /** The short form a reader recognises: the key without the variable in front of it. */
  const short = (key: string) => key.split(".")[1] ?? key;
</script>

<Panel title={lens.name}>
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: record.title, key: "analysis.analysis" }, { label: lens.name }]}
      onnavigate={(key: string) => mockWorkbench.inspect(key)}
    />
  {/snippet}

  <!-- The head of the lens has no heading: the title already names the variable. -->
  <PanelFields>
    <PanelField label="Name" mono>{lens.name}</PanelField>
    <PanelField label="Type">{lens.type}</PanelField>
    {#if lens.rows !== undefined}
      <PanelField label="Rows" mono>{rows(lens.rows)}</PanelField>
    {/if}
  </PanelFields>

  {#if preview !== undefined}
    <PanelSection
      title="Value"
      count="{preview.rows.length} of {rows(preview.total)}"
      flush
    >
      <!--
        TODO(vocabulary): needs PanelTable — a bounded, columnar prefix of a table
        value, with its header, inside a 300px panel.
      -->
      <div class="preview">
        <table class="text-caption tabular-nums w-full border-collapse">
          <thead>
            <tr>
              {#each preview.columns as column (column)}
                <th class="text-ink-muted truncate p-1 text-start font-medium">{column}</th>
              {/each}
            </tr>
          </thead>
          <tbody>
            {#each preview.rows as row (row.id)}
              <tr class="border-border-subtle border-t">
                {#each row.cells as cell, index (preview.columns[index])}
                  <td class="text-ink-secondary truncate p-1 font-mono">{cell}</td>
                {/each}
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </PanelSection>
  {:else if lens.value !== undefined}
    <PanelFields>
      <PanelField label="Value" mono stacked>{lens.value}</PanelField>
    </PanelFields>
  {/if}

  <PanelSection title="Relates to" count={relations.length} flush>
    {#each relations as relation (relation.id)}
      <PanelRow
        title={relation.variable}
        sub="{short(relation.key.left)} → {short(relation.key.right)}"
        meta={relation.used
          ? "Used by this chart"
          : `${relation.key.matched} of ${relation.key.of}`}
        tone={relation.used ? "active" : "default"}
        selected={relation.used}
        onselect={() =>
          mockWorkbench.inspect("analysis.relationship", {
            kind: "relationship",
            id: relation.id
          })}
      />
    {/each}
    {#if relations.length === 0}
      <PanelNote>This lines up with nothing. Only tables relate to other variables.</PanelNote>
    {:else}
      <PanelNote tone="gap">
        These pairings are inferred. Without a real key-inference contract they are guesses
        presented as facts, and the chart one produces is silently wrong when the guess is wrong.
      </PanelNote>
    {/if}
  </PanelSection>

  <PanelSection title="Use">
    {#if isTable}
      <!-- A field, then an axis: the keyboard path to what dragging does. -->
      <PanelSelect
        label="Field"
        value={field}
        options={FIELDS}
        onchange={(next: string) => (picked = next)}
      />
      <PanelActions>
        <PanelButton label="Put on X" icon={MoveRight} onclick={() => place("X")} />
        <PanelButton label="Put on Y" icon={MoveRight} onclick={() => place("Y")} />
      </PanelActions>
      {#if put !== undefined}
        <PanelNote>{put}</PanelNote>
      {/if}
    {:else}
      <PanelNote>
        A {lens.type} is a reference line or a filter value. An axis takes a field from a table.
      </PanelNote>
    {/if}
    <PanelNote tone="gap">
      Putting a table on an axis is not meaningful, so the buttons act on the field chosen above.
      Whether they should exist only on field rows instead is still open.
    </PanelNote>
  </PanelSection>
</Panel>

<style>
  .preview {
    overflow-x: auto;
    padding-inline: calc(var(--token-spacing-unit) * 3);
  }
</style>
