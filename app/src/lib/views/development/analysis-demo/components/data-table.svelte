<script lang="ts">
  import { PanelEditableText } from "$authored-components/panel";
  import {
    ScreenCell,
    ScreenNote,
    ScreenRow,
    ScreenTable
  } from "$authored-components/screen";

  /**
   * The numbers, editable in place.
   *
   * It is a `ScreenTable` of `PanelEditableText`, which is the composition worth
   * showing: the editing vocabulary was built for panels and drops into a table
   * cell with nothing added. A separate grid-editing component would have been
   * the obvious thing to reach for and would have been a second way to edit.
   */
  type Row = { region: string; storm: number; equipment: number; planned: number };

  let {
    rows = $bindable(),
    threshold = $bindable(0),
    hovered = $bindable(undefined),
    hidden = 0
  }: {
    rows: Row[];
    threshold?: number;
    /**
     * Shared with the chart. Hovering a column here dims the other series in the
     * picture, and hovering a band in the picture dims the other columns here —
     * one piece of state, so the two can never disagree about what is being
     * pointed at.
     */
    hovered?: string | undefined;
    hidden?: number;
  } = $props();

  const CAUSES = [
    { key: "storm", label: "Storm" },
    { key: "equipment", label: "Equipment" },
    { key: "planned", label: "Planned" }
  ] as const;

  const setNumber = (index: number, field: "storm" | "equipment" | "planned", next: string) => {
    const value = Number(next.replace(/[^0-9.-]/g, ""));
    if (Number.isNaN(value)) return;
    rows[index][field] = value;
  };
</script>

<div class="flex flex-col gap-3">
  <ScreenTable columns={["Region", "Storm", "Equipment", "Planned", "Total"]}>
    {#each rows as row, index (row.region)}
      <ScreenRow>
        <ScreenCell>
          <PanelEditableText
            value={row.region}
            label={`Region for row ${index + 1}`}
            onchange={(next) => (rows[index].region = next)}
          />
        </ScreenCell>
        {#each CAUSES as cause (cause.key)}
          <ScreenCell num>
            <span
              role="presentation"
              onpointerenter={() => (hovered = cause.key)}
              onpointerleave={() => (hovered = undefined)}
              class="block transition-opacity"
              class:opacity-30={hovered !== undefined && hovered !== cause.key}
            >
              <PanelEditableText
                value={String(row[cause.key])}
                label={`${cause.label} minutes for ${row.region}`}
                mono
                onchange={(next) => setNumber(index, cause.key, next)}
              />
            </span>
          </ScreenCell>
        {/each}
        <!-- Derived, so it is text: a total you could type is a total that can
             disagree with the numbers above it. -->
        <ScreenCell num>
          {(row.storm + row.equipment + row.planned).toLocaleString()}
        </ScreenCell>
      </ScreenRow>
    {/each}
  </ScreenTable>

  <label class="flex flex-wrap items-center gap-3">
    <span class="text-caption text-ink-muted">Hide regions under</span>
    <input
      type="range"
      min="0"
      max="2000"
      step="100"
      bind:value={threshold}
      class="accent-interactive-fill max-w-64 flex-1"
    />
    <span class="text-caption text-ink-secondary tabular-nums">
      {threshold} customer-minutes
    </span>
  </label>

  {#if hidden > 0}
    <ScreenNote>
      {hidden}
      {hidden === 1 ? "region is" : "regions are"} filtered out of the chart. The
      count above the chart says so — a chart drawn from a subset must never look
      like the whole.
    </ScreenNote>
  {/if}
</div>
