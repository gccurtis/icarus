<script lang="ts">
  import PanelControlGroup from "$authored-components/panel/panel-control-group.svelte";
  import PanelControlRow from "$authored-components/panel/panel-control-row.svelte";
  import PanelNumber from "$authored-components/panel/panel-number.svelte";
  import PanelSection from "$authored-components/panel/panel-section.svelte";

  type Field = "spaceBefore" | "spaceAfter" | "lineHeight" | "indent";

  let {
    spaceBefore,
    spaceAfter,
    lineHeight,
    indent,
    open = false,
    onchange
  }: {
    spaceBefore: number;
    spaceAfter: number;
    lineHeight: number;
    indent: number;
    open?: boolean;
    onchange?: (field: Field, next: number) => void;
  } = $props();
</script>

<PanelSection title="Spacing" {open} chevron="end">
  <PanelControlGroup flush>
    <PanelControlRow label="Space above" detail="Space above this paragraph">
      <PanelNumber label="Space above" value={spaceBefore} unit="px" min={0} max={200} flush onchange={(next) => onchange?.("spaceBefore", next)} />
    </PanelControlRow>
    <PanelControlRow label="Space below" detail="Space below this paragraph">
      <PanelNumber label="Space below" value={spaceAfter} unit="px" min={0} max={200} flush onchange={(next) => onchange?.("spaceAfter", next)} />
    </PanelControlRow>
    <PanelControlRow label="Line height">
      <PanelNumber label="Line height" value={lineHeight} unit="px" min={8} max={120} flush onchange={(next) => onchange?.("lineHeight", next)} />
    </PanelControlRow>
    <PanelControlRow label="Indent">
      <PanelNumber label="Indent" value={indent} unit="px" min={0} max={200} flush onchange={(next) => onchange?.("indent", next)} />
    </PanelControlRow>
  </PanelControlGroup>
</PanelSection>
