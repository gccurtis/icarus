<script lang="ts">
  import Crosshair from "@lucide/svelte/icons/crosshair";
  import Eraser from "@lucide/svelte/icons/eraser";

  import { Separator } from "$vendored-components/separator";
  import {
    Panel,
    PanelActions,
    PanelButton,
    PanelChip,
    PanelCode,
    PanelCrumbs,
    PanelField,
    PanelFields,
    PanelNote,
    PanelSection
  } from "$authored-components/panel";
  import { errorAt, readsOf, spreadsheetRecord } from "$capabilities/resource";
  import { isInspectionKey, viewState } from "$model/client/view-state";

  /**
   * A cell whose formula cannot resolve: what broke, the expression as written,
   * and the two ways out of it.
   *
   * `docs/screen-panel-views/inspector/resource/error-cell.md` is the
   * specification.
   *
   * **An error is a repair job, not a failure to report**, so the lens is built
   * around fixing it: the explanation is in words, the formula is set exactly as
   * stored — broken reference included, because a repaired guess is worse than the
   * fault — and the repair is the last thing on the panel.
   *
   * **Picking a new range needs to know which reference it replaces.** With one
   * broken reference that is obvious; with two the panel cannot say, so the
   * control goes dark and says why rather than rewriting the wrong one.
   */
  let {
    spreadsheetId = "r-cost",
    address = "D8"
  }: { spreadsheetId?: string; address?: string } = $props();

  const view = viewState();

  const sheet = $derived(spreadsheetRecord(spreadsheetId).current);
  const problem = $derived(errorAt(spreadsheetId, address).current);
  const broken = $derived(
    readsOf(spreadsheetId, address).current.filter((reference) => reference.kind === "broken")
  );

  /** The repair is a grid gesture; this is the panel's half of it. */
  let picking = $state(false);
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

  {#if problem === undefined}
    <PanelNote>{address} evaluates without error.</PanelNote>
  {:else}
    <!-- The head of the lens has no heading: the fault is the subject. -->
    <PanelFields>
      <PanelField label="Error"><PanelChip tone="danger">{problem.error}</PanelChip></PanelField>
    </PanelFields>
    <PanelNote>{problem.explanation}</PanelNote>
    <PanelNote>
      The formula is kept exactly as written, broken reference and all, so it can be repaired
      rather than guessed at.
    </PanelNote>

    <PanelSection title="Formula">
      <PanelCode>{problem.formula}</PanelCode>
    </PanelSection>

    <PanelSection title="Actions">
      <PanelActions>
        <PanelButton
          label={picking ? "Selecting…" : "Pick a new range"}
          icon={Crosshair}
          tone="primary"
          disabled={broken.length > 1}
          title={broken.length > 1
            ? "This formula has more than one broken reference, and the panel cannot say which one a new range would replace"
            : `Select a range on the grid to replace ${problem.error}`}
          onclick={() => (picking = true)}
        />
      </PanelActions>

      {#if picking}
        <PanelNote>Select a range on the grid. It replaces {problem.error} in the formula.</PanelNote>
        <PanelActions>
          <PanelButton label="Cancel" tone="ghost" onclick={() => (picking = false)} />
        </PanelActions>
      {/if}

      {#if broken.length > 1}
        <PanelNote tone="gap">
          {broken.length} references in this formula are broken. Replacing one needs a way to say which,
          and there is none.
        </PanelNote>
      {/if}

      <!-- Destructive, so it is last and behind a rule rather than beside the repair. -->
      <Separator />
      <PanelActions>
        <PanelButton
          label="Clear cell"
          icon={Eraser}
          tone="danger"
          title="Remove the formula. The lens falls back to the spreadsheet, because a cleared coordinate holds nothing to inspect"
          onclick={() => view.inspect("resource.spreadsheet")}
        />
      </PanelActions>
    </PanelSection>
  {/if}
</Panel>
