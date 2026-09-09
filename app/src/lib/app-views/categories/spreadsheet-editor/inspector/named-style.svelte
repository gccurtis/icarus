<script lang="ts">
  import AlignCenter from "@lucide/svelte/icons/align-center";
  import AlignLeft from "@lucide/svelte/icons/align-left";
  import AlignRight from "@lucide/svelte/icons/align-right";
  import Copy from "@lucide/svelte/icons/copy";
  import Trash2 from "@lucide/svelte/icons/trash-2";

  import {
    Panel,
    PanelButton,
    PanelChoice,
    PanelControlGroup,
    PanelControlRow,
    PanelCrumbs,
    PanelEmpty,
    PanelInlineStyle,
    PanelNumber,
    PanelSection,
    PanelSelect
  } from "$authored-components/panel";
  import { Input } from "$vendored-components/input";
  import { gridOf } from "$app-views/categories/spreadsheet-editor/procedures/addresses";
  import type { Edit } from "$app-views/categories/spreadsheet-editor/procedures/cells";
  import { FILLS, INKS, orClear, orNone } from "$app-views/categories/spreadsheet-editor/procedures/colors";
  import { DEFAULT_FONT_SIZE, FAMILIES, type CellStyle } from "$app-views/categories/spreadsheet-editor/procedures/formatting";
  import { STYLES, type MarkStyle } from "$app-views/categories/spreadsheet-editor/procedures/marks";
  import { STYLE, styleSignal } from "$app-views/categories/spreadsheet-editor/procedures/selecting";
  import { deletedStyle, madeDefault, newStyle, setStyleField } from "$app-views/categories/spreadsheet-editor/procedures/styles";
  import { isInspectorView, workspaceState, type SpreadsheetRuntime } from "$model/client/workspace-state";

  const FAMILY_OPTIONS = FAMILIES.map((family) => ({ value: family, label: family }));

  const ALIGN = [
    { value: "start", label: "Left", icon: AlignLeft },
    { value: "center", label: "Center", icon: AlignCenter },
    { value: "end", label: "Right", icon: AlignRight }
  ];

  const view = workspaceState();

  const sheetId = $derived(view.active.resourceId);

  let runtime = $state<SpreadsheetRuntime | undefined>(undefined);

  $effect(() => {
    runtime = sheetId === undefined ? undefined : view.spreadsheetRuntime(sheetId);
  });

  const sheet = $derived(runtime?.sheet);
  const grid = $derived(gridOf(sheet?.body));
  const key = $derived(view.selection?.kind === STYLE ? view.selection.id : undefined);
  const style = $derived(key === undefined ? undefined : sheet?.body.styles.styles[key]);
  const isDefault = $derived(key !== undefined && sheet?.body.styles.defaultKey === key);
  const marks = $derived.by((): MarkStyle[] => {
    if (style === undefined) return [];
    return [
      ...(style.bold === true || (style.fontWeight ?? 0) >= 600 ? ["bold" as const] : []),
      ...(style.italic === true ? ["italic" as const] : []),
      ...(style.underline === true ? ["underline" as const] : []),
      ...(style.strikethrough === true ? ["strikethrough" as const] : [])
    ];
  });

  let refusal = $state<string | undefined>(undefined);

  const apply = (ops: Edit["ops"]) => {
    if (ops.length > 0) runtime?.apply(ops);
  };

  const field = (name: keyof CellStyle, value: unknown) => {
    if (sheet === undefined || key === undefined) return;
    const op = setStyleField(sheet.body, key, name, value);
    if (op !== undefined) apply([op]);
  };

  const rename = (next: string) => {
    if (style === undefined) return;
    field("name", next.trim() === "" ? style.name : next.trim());
  };

  const marked = (next: string[]) => {
    for (const { value } of STYLES) {
      const wanted = next.includes(value);
      const had = marks.includes(value);
      if (wanted === had) continue;
      if (value === "bold") {
        field("bold", wanted ? true : null);
        field("fontWeight", null);
      } else if (value === "italic" || value === "underline" || value === "strikethrough") {
        field(value, wanted ? true : null);
      }
    }
  };

  const duplicate = () => {
    if (sheet === undefined || style === undefined) return;
    const made = newStyle(sheet.body, style);
    apply(made.ops);
    const signal = styleSignal(made.key);
    view.inspect(signal.key, signal.selection);
  };

  const makeDefault = () => {
    if (sheet === undefined || key === undefined) return;
    const op = madeDefault(sheet.body, key);
    if (op !== undefined) apply([op]);
  };

  const remove = () => {
    if (sheet === undefined || key === undefined) return;
    const edit = deletedStyle(sheet.body, key);
    if (edit.refused !== undefined) {
      refusal = edit.refused;
      return;
    }
    apply(edit.ops);
    view.selectContext("spreadsheet-editor.styles");
    view.inspect("spreadsheet-editor.spreadsheet");
  };

  const navigate = (next: string) => {
    if (isInspectorView(next)) view.inspect(next);
  };
</script>

<Panel title={style?.name ?? "Style"}>
  {#snippet crumbs()}
    <PanelCrumbs trail={[{ label: "Spreadsheet", key: "spreadsheet-editor.spreadsheet" }, { label: "Style" }]} onnavigate={navigate} />
  {/snippet}

  {#if sheet && key && style}
    <div class="identity">
      <Input
        value={style.name}
        aria-label="Style name"
        class="text-body h-9"
        onchange={(event: Event & { currentTarget: EventTarget & HTMLInputElement }) => rename(event.currentTarget.value)}
      />
      <div class="actions">
        <PanelButton label="Duplicate" icon={Copy} onclick={duplicate} />
        <PanelButton label="Delete" icon={Trash2} tone="danger" disabled={isDefault} title={isDefault ? "The default style stays" : undefined} onclick={remove} />
        {#if !isDefault}
          <PanelButton label="Make default" tone="ghost" onclick={makeDefault} />
        {/if}
      </div>
      {#if refusal}
        <span class="text-caption text-danger-text">{refusal}</span>
      {/if}
    </div>

    <PanelSection title="Typography">
      <PanelControlGroup flush>
        <PanelControlRow label="Font">
          <PanelSelect label="Font" value={style.fontFamily ?? FAMILIES[0]} options={FAMILY_OPTIONS} onchange={(next) => field("fontFamily", next)} />
        </PanelControlRow>
        <PanelControlRow label="Font size">
          <PanelNumber label="Font size" value={style.fontSize ?? DEFAULT_FONT_SIZE} unit="px" min={6} max={96} flush onchange={(next) => field("fontSize", next)} />
        </PanelControlRow>
        <PanelInlineStyle
          marks={[...marks]}
          options={STYLES}
          foreground={orNone(style.color)}
          background={orNone(style.background)}
          foregroundOptions={INKS}
          backgroundOptions={FILLS}
          onmarks={marked}
          onforeground={(next: string) => field("color", orClear(next))}
          onbackground={(next: string) => field("background", orClear(next))}
        />
        <PanelControlRow label="Align">
          <PanelChoice label="Alignment" value={style.horizontalAlignment ?? ""} options={ALIGN} fill flush onchange={(next) => field("horizontalAlignment", next)} />
        </PanelControlRow>
      </PanelControlGroup>
    </PanelSection>
  {:else}
    <PanelEmpty title="Pick a style in the Styles panel" />
  {/if}
</Panel>

<style>
  .identity {
    display: flex;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 2);
    padding: calc(var(--token-spacing-unit) * 2) calc(var(--token-spacing-unit) * 3);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: calc(var(--token-spacing-unit) * 1.5);
  }
</style>
