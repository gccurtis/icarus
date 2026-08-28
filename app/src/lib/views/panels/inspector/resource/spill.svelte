<script lang="ts">
  import {
    Panel,
    PanelCode,
    PanelCrumbs,
    PanelField,
    PanelFields,
    PanelLink,
    PanelNote,
    PanelSection
  } from "$components/authored/panel";
  import { spillAt, spreadsheetRecord } from "$capabilities/resource";
  import { isInspectionKey, viewState } from "$model/client/view-state";

  /**
   * A cell filled by a formula somewhere else: where the value came from, and why
   * you cannot type here.
   *
   * `docs/screen-panel-views/inspector/resource/spill.md` is the specification.
   *
   * **The lens exists to explain a difference, not to report a state.** A spill
   * child looks exactly like a cell with a number in it and behaves like a
   * read-only projection, and the first time somebody types into one is the moment
   * that has to be explained.
   *
   * **The origin is a link, unless this cell is the origin.** A control that
   * reselects what is already selected teaches nothing and looks broken, so at the
   * origin the address is set as plain text.
   */
  let {
    spreadsheetId = "r-cost",
    address = "E3"
  }: { spreadsheetId?: string; address?: string } = $props();

  const view = viewState();

  const sheet = $derived(spreadsheetRecord(spreadsheetId).current);
  const spill = $derived(spillAt(spreadsheetId, address).current);
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

  {#if spill === undefined}
    <PanelNote>
      {address} is not part of a spill. Whatever it holds, it holds on its own account.
    </PanelNote>
  {:else}
    <!-- The head of the lens has no heading: the title already names the cell. -->
    <PanelFields>
      <PanelField label="Origin" mono>
        {#if spill.origin === address}
          {spill.origin}
        {:else}
          <PanelLink
            label={spill.origin}
            title="Open the formula that fills this range"
            onselect={() =>
              view.inspect("resource.cell-with-formula", {
                kind: "cell",
                id: spill.origin
              })}
          />
        {/if}
      </PanelField>
      <PanelField label="Occupied" mono>{spill.occupied}</PanelField>
      <PanelField label="Status">{spill.status}</PanelField>
    </PanelFields>

    <!-- The formula is here rather than one click away: the fix is at the symptom. -->
    <PanelSection title="Origin formula">
      <PanelCode>{spill.originFormula}</PanelCode>
      <PanelNote>
        It produced the whole of {spill.occupied}. Changing it is how {address} changes.
      </PanelNote>
    </PanelSection>

    <PanelSection title="Behavior">
      <PanelNote>
        A write anywhere in {spill.occupied} fails visibly and names {spill.origin}. It is refused
        rather than accepted quietly, and the spill does not stop spilling to make room for it.
      </PanelNote>
      <PanelNote tone="gap">
        The calculation engine has no defined write-collision behaviour yet. A silent failure is
        the worst outcome here and the easiest one to build by accident, which is why the rule is
        stated before it is implemented.
      </PanelNote>
    </PanelSection>
  {/if}
</Panel>
