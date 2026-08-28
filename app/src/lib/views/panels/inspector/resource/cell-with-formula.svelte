<script lang="ts">
  import {
    Panel,
    PanelCrumbs,
    PanelEditableText,
    PanelField,
    PanelFields,
    PanelLink,
    PanelNote,
    PanelRow,
    PanelSection
  } from "$components/authored/panel";
  import {
    cell,
    feedsOf,
    readsOf,
    sheetStyle,
    spreadsheetRecord,
    type CellReference
  } from "$capabilities/resource";
  import { isInspectionKey, viewState } from "$model/client/view-state";

  /**
   * A cell whose content is an expression: what it evaluates to, the expression
   * itself, what it reads, what it feeds, and how it is formatted.
   *
   * `docs/screen-panel-views/inspector/resource/cell-with-formula.md` is the
   * specification.
   *
   * **This lens replaces the formula bar.** A bar takes a row off the grid to show
   * one line of text; the expression is edited here or in the cell instead, which
   * is why it is stacked across the whole panel and set to wrap rather than
   * scroll. What a bar could never carry is the two bands under it: the same
   * formula's dependencies, in both directions.
   *
   * **Shows and Type describe the result, not the expression.** A formatted number
   * and the value underneath it are different claims and both belong at the top.
   */
  let {
    spreadsheetId = "r-cost",
    address = "G3"
  }: { spreadsheetId?: string; address?: string } = $props();

  const view = viewState();

  const sheet = $derived(spreadsheetRecord(spreadsheetId).current);
  const row = $derived(cell(spreadsheetId, address).current);
  const style = $derived(row?.styleId === undefined ? undefined : sheetStyle(row.styleId).current);
  const reads = $derived(readsOf(spreadsheetId, address).current);
  const feeds = $derived(feedsOf(spreadsheetId, address).current);

  /** The edit, until there is a grid to write it to. */
  let edited = $state<string | undefined>(undefined);
  const formula = $derived(edited ?? row?.formula ?? row?.content ?? "");

  const ALIGNMENT = { left: "Left", center: "Center", right: "Right" } as const;

  /**
   * A reference opens the lens for what it actually is. A broken one opens
   * nothing: there is no cell at `#REF!` and no name behind `eventCount`, so the
   * row states the fault instead of pretending to lead somewhere.
   */
  const open = (reference: CellReference) => {
    if (reference.kind === "named range") {
      view.inspect("resource.named-range", {
        kind: "named-range",
        id: reference.address
      });
      return;
    }
    const key =
      reference.kind === "spill child"
        ? "resource.spill"
        : reference.kind === "formula"
          ? "resource.cell-with-formula"
          : "resource.cell";
    view.inspect(key, { kind: "cell", id: reference.address });
  };

  const qualifies = (reference: CellReference) => reference.note ?? reference.kind;
</script>

<Panel title={address}>
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: sheet.title, key: "resource.spreadsheet" }, { label: address }]}
      onnavigate={(key) => {
        if (isInspectionKey(key)) view.inspect(key);
      }}
    />
  {/snippet}

  {#if row === undefined}
    <PanelNote>Nothing is stored at {address}.</PanelNote>
  {:else}
    <PanelFields>
      <PanelField label="Address" mono>{row.address}</PanelField>
      <PanelField label="Shows" mono>{row.shows}</PanelField>
      <PanelField label="Type">{row.type}</PanelField>
    </PanelFields>

    <!--
      Stacked and multiline, which is the whole point of the band: the grid carries
      no formula bar, so a 300px panel is the only place a long expression has to
      breathe.
    -->
    <PanelSection title="Formula">
      <PanelFields>
        <PanelField label="Expression" stacked>
          <PanelEditableText
            label="Formula"
            value={formula}
            mono
            multiline
            placeholder="Empty"
            onchange={(next) => (edited = next)}
          />
        </PanelField>
      </PanelFields>
      <PanelNote>
        Edited here or in the cell. There is no separate formula bar taking a row off the grid.
      </PanelNote>
      <PanelNote tone="gap">
        Set as plain mono. Syntax colouring is what makes a wrapped expression readable at this
        width, and nothing tokenises the expression yet.
      </PanelNote>
    </PanelSection>

    <PanelSection title="Reads" count={reads.length} flush>
      {#each reads as reference (reference.address)}
        <PanelRow
          title={reference.address}
          sub={qualifies(reference)}
          meta={reference.shows}
          tone={reference.kind === "broken" ? "danger" : "default"}
          titleTone={reference.kind === "broken" ? "danger" : undefined}
          onselect={reference.kind === "broken" ? undefined : () => open(reference)}
        />
      {:else}
        <PanelNote>This expression reads no other cell.</PanelNote>
      {/each}
    </PanelSection>

    <!-- Context rather than the reason the cell was opened, so it arrives shut. -->
    <PanelSection title="Feeds" count={feeds.length} open={false} flush>
      {#each feeds as reference (reference.address)}
        <PanelRow
          title={reference.address}
          sub={reference.shows}
          onselect={() => open(reference)}
        />
      {:else}
        <PanelNote>No formula reads {address}.</PanelNote>
      {/each}
    </PanelSection>

    <PanelSection title="Format" open={false}>
      <PanelFields>
        <PanelField label="Style">
          {#if style === undefined}
            None
          {:else}
            <PanelLink
              label={style.name}
              title="Open the {style.name} style"
              onselect={() =>
                view.inspect("resource.named-style-sheet", {
                  kind: "cell-style",
                  id: style.id
                })}
            />
          {/if}
        </PanelField>
        <PanelField label="Alignment">{ALIGNMENT[row.alignment]}</PanelField>
        <PanelField label="Value format" mono>
          {row.valueFormat ?? style?.valueFormat ?? "None"}
        </PanelField>
      </PanelFields>
    </PanelSection>
  {/if}
</Panel>
