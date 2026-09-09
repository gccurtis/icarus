<script lang="ts">
  import { PanelControlGroup, PanelControlRow, PanelSection, PanelSelect } from "$authored-components/panel";
  import { Input } from "$vendored-components/input";
  import { gridOf, keyOf, refsIn } from "$app-views/categories/spreadsheet-editor/procedures/addresses";
  import { setField, type Edit } from "$app-views/categories/spreadsheet-editor/procedures/cells";
  import { paintOf } from "$app-views/categories/spreadsheet-editor/procedures/formatting";
  import {
    PLAIN,
    PREFIXES,
    SUFFIXES,
    partsOf,
    patternOf,
    reconciled,
    type DecimalMark,
    type NumberFormatParts,
    type Thousands
  } from "$app-views/categories/spreadsheet-editor/procedures/number-format";
  import { selectedRects, selectedRef } from "$app-views/categories/spreadsheet-editor/procedures/selection-reading";
  import { ruleFormatOver } from "$app-views/categories/spreadsheet-editor/procedures/styles";
  import { holdsTheRuntime } from "$app-views/categories/spreadsheet-editor/procedures/effects/holds-the-runtime.svelte";
  import { mirrorsADraft } from "$app-views/categories/spreadsheet-editor/procedures/effects/mirrors-a-draft.svelte";
  import { workspaceState } from "$model/client/workspace-state";

  const CUSTOM = "custom";

  const PREFIX_OPTIONS = [
    { value: "", label: "None" },
    ...PREFIXES.map((prefix) => ({ value: prefix, label: prefix })),
    { value: CUSTOM, label: "Custom…" }
  ];

  const SUFFIX_OPTIONS = [
    { value: "", label: "None" },
    ...SUFFIXES.map((suffix) => ({ value: suffix, label: suffix })),
    { value: CUSTOM, label: "Custom…" }
  ];

  const MARK_OPTIONS = [
    { value: ".", label: "Period" },
    { value: ",", label: "Comma" }
  ];

  const THOUSANDS_OPTIONS = [
    { value: "none", label: "None" },
    { value: ",", label: "Comma" },
    { value: ".", label: "Period" },
    { value: " ", label: "Space" }
  ];

  const view = workspaceState();

  const sheetId = $derived(view.active.resourceId);

  const attached = holdsTheRuntime();
  const runtime = $derived(attached.current);

  const sheet = $derived(runtime?.sheet);
  const grid = $derived(gridOf(sheet?.body));
  const rects = $derived(selectedRects(grid, view.selection));
  const ref = $derived(selectedRef(view.selection));
  const held = $derived(sheet === undefined || ref === undefined ? undefined : sheet.cells[keyOf(ref)]);

  const patterns = $derived(
    sheet === undefined
      ? []
      : [
          ...new Set(
            rects.flatMap((rect) =>
              refsIn(grid, rect).map((at) => paintOf(sheet.body, grid, at, sheet.cells[keyOf(at)]).format.valueFormat ?? "")
            )
          )
        ]
  );
  const mixed = $derived(patterns.length > 1);
  const parts = $derived(patterns.length === 1 ? partsOf(patterns[0]) : PLAIN);
  const natural = $derived.by(() => {
    if (sheet === undefined) return 0;
    for (const rect of rects) {
      for (const at of refsIn(grid, rect)) {
        const value = sheet.cells[keyOf(at)]?.value;
        if (value?.kind === "number") return (String(Math.abs(value.value)).split(".")[1] ?? "").length;
      }
    }
    return 0;
  });

  const listedPrefix = (prefix: string): boolean => prefix === "" || PREFIXES.some((held) => held === prefix);
  const listedSuffix = (suffix: string): boolean => suffix === "" || SUFFIXES.some((held) => held === suffix);

  let customPrefix = $state(false);
  let customSuffix = $state(false);
  const decimalsField = mirrorsADraft(() => (parts.decimals === undefined ? "" : String(parts.decimals)));

  const prefixChoice = $derived(customPrefix || !listedPrefix(parts.prefix) ? CUSTOM : parts.prefix);
  const suffixChoice = $derived(customSuffix || !listedSuffix(parts.suffix) ? CUSTOM : parts.suffix);

  const apply = (ops: Edit["ops"]) => {
    if (ops.length > 0) runtime?.apply(ops);
  };

  const write = (next: NumberFormatParts) => {
    if (sheet === undefined) return;
    const pattern = patternOf(next);
    if (ref !== undefined && held !== undefined) {
      apply([setField(sheet, ref, "format/valueFormat", pattern)]);
      return;
    }
    apply(ruleFormatOver(sheet.body, grid, rects, "valueFormat", pattern));
  };

  const set = (patch: Partial<NumberFormatParts>) => write({ ...parts, ...patch });

  const choosePrefix = (next: string) => {
    if (next === CUSTOM) {
      customPrefix = true;
      return;
    }
    customPrefix = false;
    set({ prefix: next });
  };

  const chooseSuffix = (next: string) => {
    if (next === CUSTOM) {
      customSuffix = true;
      return;
    }
    customSuffix = false;
    set({ suffix: next });
  };

  const decimalsChanged = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed === "") {
      set({ decimals: undefined });
      return;
    }
    const count = Number(trimmed);
    if (!Number.isInteger(count) || count < 0 || count > 10) {
      decimalsField.current = parts.decimals === undefined ? "" : String(parts.decimals);
      return;
    }
    set({ decimals: count });
  };
</script>

{#if sheet && rects.length > 0}
  <PanelSection title="Number format">
    <PanelControlGroup flush>
      <PanelControlRow label="Prefix">
        <PanelSelect label="Prefix" value={prefixChoice} {mixed} options={PREFIX_OPTIONS} onchange={choosePrefix} />
        {#if prefixChoice === CUSTOM}
          <Input
            value={parts.prefix}
            placeholder="Text"
            aria-label="Custom prefix"
            class="text-caption h-7 px-1.5"
            onchange={(event: Event & { currentTarget: EventTarget & HTMLInputElement }) => set({ prefix: event.currentTarget.value })}
          />
        {/if}
      </PanelControlRow>
      <PanelControlRow label="Suffix">
        <PanelSelect label="Suffix" value={suffixChoice} {mixed} options={SUFFIX_OPTIONS} onchange={chooseSuffix} />
        {#if suffixChoice === CUSTOM}
          <Input
            value={parts.suffix}
            placeholder="Text"
            aria-label="Custom suffix"
            class="text-caption h-7 px-1.5"
            onchange={(event: Event & { currentTarget: EventTarget & HTMLInputElement }) => set({ suffix: event.currentTarget.value })}
          />
        {/if}
      </PanelControlRow>
      <PanelControlRow label="Figs">
        <Input
          type="number"
          value={decimalsField.current}
          min={0}
          max={10}
          placeholder={String(natural)}
          inputmode="numeric"
          aria-label="Decimal places"
          class="text-caption h-7 px-1.5 [appearance:textfield] tabular-nums [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
          oninput={(event: Event & { currentTarget: EventTarget & HTMLInputElement }) => {
            decimalsField.current = event.currentTarget.value;
          }}
          onchange={(event: Event & { currentTarget: EventTarget & HTMLInputElement }) => decimalsChanged(event.currentTarget.value)}
        />
      </PanelControlRow>
      <PanelControlRow label="Decimal">
        <PanelSelect
          label="Decimal mark"
          value={parts.mark}
          {mixed}
          options={MARK_OPTIONS}
          onchange={(next) => write(reconciled({ ...parts, mark: next as DecimalMark }, "mark"))}
        />
      </PanelControlRow>
      <PanelControlRow label="Thousands">
        <PanelSelect
          label="Thousands separator"
          value={parts.thousands}
          {mixed}
          options={THOUSANDS_OPTIONS}
          onchange={(next) => write(reconciled({ ...parts, thousands: next as Thousands }, "thousands"))}
        />
      </PanelControlRow>
    </PanelControlGroup>
  </PanelSection>
{/if}
