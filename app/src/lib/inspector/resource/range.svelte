<script lang="ts">
  import Combine from "@lucide/svelte/icons/combine";
  import Eraser from "@lucide/svelte/icons/eraser";
  import Tag from "@lucide/svelte/icons/tag";

  import { Separator } from "$lib/simple-components/separator";
  import {
    Panel,
    PanelActions,
    PanelButton,
    PanelCrumbs,
    PanelEditableText,
    PanelField,
    PanelFields,
    PanelNote,
    PanelSection,
    PanelSelect
  } from "$lib/unique-components/panel";
  import {
    rangeSelection,
    sheetStyles,
    spreadsheetRecord,
    type SharedProperty
  } from "$mock-capabilities/resource";
  import { mockWorkbench } from "$mock-models/workbench.svelte";

  /**
   * Several cells selected together: what the block contains, where it agrees,
   * what it sums to, and the three things you can do to it at once.
   *
   * `docs/screen-panel-views/inspector/resource/range.md` is the specification.
   *
   * **Mixed is a value, not a blank.** A property the selection disagrees on shows
   * nothing selected rather than one cell's answer, and setting over it applies to
   * every cell in the range — which is why the formatting band is controls and not
   * a read-out.
   *
   * **Cells with content is counted against coordinates covered.** On a sparse
   * grid a range can be large and almost empty, and one number without the other
   * hides that.
   */
  let {
    spreadsheetId = "r-cost",
    a1 = "A1:G1"
  }: { spreadsheetId?: string; a1?: string } = $props();

  const sheet = $derived(spreadsheetRecord(spreadsheetId).current);
  const selection = $derived(rangeSelection(spreadsheetId, a1).current);
  const styles = $derived(sheetStyles(spreadsheetId).current);

  const styleOptions = $derived(styles.map((style) => ({ value: style.name, label: style.name })));

  const ALIGNMENTS = [
    { value: "Left", label: "Left" },
    { value: "Center", label: "Center" },
    { value: "Right", label: "Right" }
  ] as const;

  /**
   * What has been set over the selection, by property. A property with an entry
   * here is no longer mixed: one answer has been given for the whole block.
   */
  let settings = $state<Record<string, string>>({});

  const valueOf = (property: SharedProperty) =>
    settings[property.label] ?? (property.mixed ? "" : property.value);
  const mixedOf = (property: SharedProperty) =>
    property.mixed && settings[property.label] === undefined;
  const set = (label: string, next: string) => (settings = { ...settings, [label]: next });

  /** Only the properties the panel vocabulary has a control for are settable. */
  const optionsFor = (label: string): readonly { value: string; label: string }[] | undefined => {
    if (label === "Style") return styleOptions;
    if (label === "Alignment") return ALIGNMENTS;
    return undefined;
  };

  const empty = $derived(selection.coordinates - selection.cellsWithContent);
  const first = $derived(selection.a1.split(":")[0]);

  let naming = $state(false);
  let rangeName = $state("");
  let clearing = $state(false);
</script>

<Panel title={selection.a1}>
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: sheet.title, key: "resource.spreadsheet" }, { label: selection.a1 }]}
      onnavigate={(key) => mockWorkbench.inspect(key)}
    />
  {/snippet}

  <!-- The head of the lens has no heading: the title already names the block. -->
  <PanelFields>
    <PanelField label="A1 range" mono>{selection.a1}</PanelField>
    <PanelField label="Cells with content" mono>
      {selection.cellsWithContent} of {selection.coordinates}
    </PanelField>
  </PanelFields>

  <PanelSection title="Shared formatting">
    <PanelFields>
      {#each selection.formatting as property (property.label)}
        {@const options = optionsFor(property.label)}
        <PanelField label={property.label} stacked>
          {#if options === undefined}
            <!--
              TODO(vocabulary): needs PanelColor — a swatch that sets a fill and
              can also read Mixed, the way PanelSelect does for a listed value.
            -->
            {mixedOf(property) ? "Mixed" : valueOf(property)}
          {:else}
            <PanelSelect
              label={property.label}
              value={valueOf(property)}
              options={options}
              mixed={mixedOf(property)}
              onchange={(next) => set(property.label, next)}
            />
          {/if}
        </PanelField>
      {/each}
    </PanelFields>
    <PanelNote>Setting a property the selection disagrees on applies it to every cell in it.</PanelNote>
  </PanelSection>

  <!-- The numbers you would otherwise compute by hand. Not why the block was selected. -->
  <PanelSection title="Aggregate" open={false}>
    <PanelFields>
      {#each selection.aggregate as measure (measure.label)}
        <PanelField label={measure.label} mono>{measure.value}</PanelField>
      {/each}
    </PanelFields>
    <PanelNote tone="gap">
      The status bar already carries sum, average and count for the selection. Whether this band
      adds anything, or should carry the measures the bar cannot fit, is undecided.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Actions">
    <PanelActions>
      <PanelButton
        label="Name this range"
        icon={Tag}
        tone="primary"
        onclick={() => (naming = true)}
      />
      <PanelButton
        label="Merge"
        icon={Combine}
        title="Merge {selection.a1} into one block anchored at {first}"
        onclick={() => mockWorkbench.inspect("resource.cell", { kind: "cell", id: first })}
      />
    </PanelActions>

    {#if naming}
      <PanelFields>
        <PanelField label="Name" stacked>
          <PanelEditableText
            label="Range name"
            value={rangeName}
            mono
            placeholder="costModel"
            onchange={(next) => (rangeName = next)}
          />
        </PanelField>
      </PanelFields>
      {#if rangeName !== ""}
        <PanelNote>
          {rangeName} resolves to {selection.a1}, in this spreadsheet and nowhere else.
        </PanelNote>
      {/if}
    {/if}

    <!-- Destructive, so it is last and behind a rule rather than beside the rest. -->
    <Separator />
    {#if clearing}
      <PanelNote>
        Clearing removes the content of {selection.cellsWithContent} cells. Formatting stays.
      </PanelNote>
      <PanelActions>
        <PanelButton label="Cancel" tone="ghost" onclick={() => (clearing = false)} />
        <PanelButton label="Clear" icon={Eraser} tone="danger" onclick={() => (clearing = false)} />
      </PanelActions>
    {:else}
      <PanelActions>
        <PanelButton label="Clear" icon={Eraser} tone="danger" onclick={() => (clearing = true)} />
      </PanelActions>
    {/if}
  </PanelSection>

  <PanelSection title="Empty coordinates" count={empty} open={false}>
    {#if empty === 0}
      <PanelNote>Every coordinate in {selection.a1} holds a cell.</PanelNote>
    {:else}
      <PanelNote>
        {empty} of the {selection.coordinates} coordinates in {selection.a1} hold nothing.
      </PanelNote>
    {/if}
    <PanelNote tone="gap">
      Formatting is stored on a block, and an empty coordinate has none. Formatting an empty range
      either does nothing or mints a block for every coordinate in it, and the model chooses
      neither.
    </PanelNote>
  </PanelSection>
</Panel>
