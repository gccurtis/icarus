<script lang="ts">
  import AlignVerticalJustifyCenter from "@lucide/svelte/icons/align-vertical-justify-center";
  import AlignVerticalJustifyEnd from "@lucide/svelte/icons/align-vertical-justify-end";
  import AlignVerticalJustifyStart from "@lucide/svelte/icons/align-vertical-justify-start";
  import Copy from "@lucide/svelte/icons/copy";
  import Trash2 from "@lucide/svelte/icons/trash-2";

  import {
    Panel,
    PanelAlignment,
    PanelButton,
    PanelChoice,
    PanelControlGroup,
    PanelControlRow,
    PanelCrumbs,
    PanelEditableText,
    PanelInlineStyle,
    PanelNote,
    PanelNumber,
    PanelSection,
    PanelSelect
  } from "$authored-components/panel";
  import { swatchesFor, withNone } from "$app-views/categories/slide-deck-editor/procedures/palette";
  import {
    defaultStyleEdit,
    deleteStyleEdit,
    duplicateStyleEdit,
    familyOptions,
    styleFieldEdit,
    styleFieldsEdit,
    type TextStyle
  } from "$app-views/categories/slide-deck-editor/procedures/styles";
  import { workspaceState, type SlideDeckRuntime } from "$model/client/workspace-state";

  const MARKS = [
    { value: "bold", label: "Bold" },
    { value: "italic", label: "Italic" },
    { value: "underline", label: "Underline" },
    { value: "strikethrough", label: "Strikethrough" }
  ];

  const VERTICAL = [
    { value: "top", label: "Top", icon: AlignVerticalJustifyStart },
    { value: "middle", label: "Middle", icon: AlignVerticalJustifyCenter },
    { value: "bottom", label: "Bottom", icon: AlignVerticalJustifyEnd }
  ];

  const view = workspaceState();
  const deckId = view.active.resourceId;
  let runtime = $state<SlideDeckRuntime | undefined>(undefined);

  $effect(() => {
    runtime = deckId === undefined ? undefined : view.slideDeckRuntime(deckId);
  });

  const body = $derived(runtime?.body);
  const key = $derived(view.selection?.id ?? "");
  const style = $derived(body?.styles.styles[key]);
  const isDefault = $derived(body?.styles.defaultKey === key);
  const colours = $derived(body === undefined ? [] : withNone(swatchesFor(body.theme)));
  const marks = $derived.by(() => {
    if (style === undefined) return [];
    return [
      ...(style.bold === true || (style.fontWeight ?? 0) >= 600 ? ["bold"] : []),
      ...(style.italic === true ? ["italic"] : []),
      ...(style.underline === true ? ["underline"] : []),
      ...(style.strikethrough === true ? ["strikethrough"] : [])
    ];
  });

  const commit = (ops: Parameters<SlideDeckRuntime["apply"]>[0]) => {
    if (ops.length > 0) runtime?.apply(ops);
  };

  const setField = <K extends keyof TextStyle>(field: K, value: TextStyle[K] | undefined) => {
    if (body !== undefined) commit(styleFieldEdit(body, key, field, value).ops);
  };

  const setMarks = (next: string[]) => {
    if (body === undefined || style === undefined) return;
    const patch: Partial<TextStyle> = {};
    for (const { value } of MARKS) {
      const wanted = next.includes(value);
      const had = marks.includes(value);
      if (wanted === had) continue;
      if (value === "bold") {
        patch.bold = wanted ? true : undefined;
        patch.fontWeight = undefined;
      } else if (value === "italic") patch.italic = wanted ? true : undefined;
      else if (value === "underline") patch.underline = wanted ? true : undefined;
      else patch.strikethrough = wanted ? true : undefined;
    }
    commit(styleFieldsEdit(body, key, patch).ops);
  };

  const rename = (name: string) => {
    const next = name.trim();
    if (next.length > 0) setField("name", next);
  };

  const makeDefault = () => {
    if (body !== undefined) commit(defaultStyleEdit(body, key).ops);
  };

  const duplicate = () => {
    if (body === undefined) return;
    const made = duplicateStyleEdit(body, key);
    commit(made.edit.ops);
    if (made.key !== undefined) view.inspect("slide-deck-editor.named-style", { kind: "named-style", id: made.key });
  };

  const remove = () => {
    if (body === undefined) return;
    commit(deleteStyleEdit(body, key).ops);
    view.selectContext("slide-deck-editor.theme");
    view.clear();
  };
</script>

<Panel title={style?.name ?? "Style"}>
  {#snippet heading()}
    <h2 class="text-body-sm text-ink-secondary m-0 min-w-0 font-semibold">
      {#if style === undefined}
        Style
      {:else}
        <PanelEditableText label="Style name" value={style.name} onchange={rename} />
      {/if}
    </h2>
  {/snippet}

  {#snippet crumbs()}
    <PanelCrumbs trail={[{ label: "Deck" }, { label: "Style" }]} onnavigate={() => {}} />
  {/snippet}

  {#snippet actions()}
    <PanelButton label={isDefault ? "Default style" : "Make default"} tone="ghost" disabled={style === undefined || isDefault} title={isDefault ? "This is already the default style" : undefined} onclick={makeDefault} />
    <PanelButton label="Duplicate" icon={Copy} disabled={style === undefined} onclick={duplicate} />
    <PanelButton label="Delete" icon={Trash2} tone="danger" disabled={style === undefined || isDefault} title={isDefault ? "The default style cannot be deleted" : undefined} onclick={remove} />
  {/snippet}

  {#if style === undefined}
    <div class="pt-2"><PanelNote tone="muted">The deck has no style called {key}.</PanelNote></div>
  {:else}
    <PanelSection title="Text style">
      <div class="grid min-w-0 grid-cols-[minmax(0,1fr)_5.5rem] gap-2">
        <label class="flex min-w-0 flex-col gap-1">
          <span class="text-caption text-ink-muted">Font</span>
          <PanelSelect label="Font" value={style.fontFamily ?? body?.theme.fontFamily ?? "IBM Plex Sans"} options={familyOptions()} onchange={(next) => setField("fontFamily", next)} />
        </label>
        <label class="flex min-w-0 flex-col gap-1">
          <span class="text-caption text-ink-muted">Size</span>
          <PanelNumber label="Font size" value={style.fontSize ?? 20} unit="px" min={6} max={200} flush onchange={(next) => setField("fontSize", next)} />
        </label>
      </div>
      <PanelInlineStyle
        marks={[...marks]}
        options={MARKS}
        foreground={style.color ?? ""}
        background={style.background ?? ""}
        foregroundOptions={colours}
        backgroundOptions={colours}
        prefix="for this style"
        onmarks={setMarks}
        onforeground={(next) => setField("color", next === "" ? undefined : next)}
        onbackground={(next) => setField("background", next === "" ? undefined : next)}
      />
      <PanelAlignment value={style.horizontalAlignment ?? "start"} onchange={(next) => setField("horizontalAlignment", next)} />
      <PanelChoice label="Vertical alignment" value={style.verticalAlignment ?? "top"} options={VERTICAL} flush fill onchange={(next) => setField("verticalAlignment", next === "top" ? undefined : next as "middle" | "bottom")} />
    </PanelSection>

    <PanelSection title="Spacing" open={false} chevron="end">
      <PanelControlGroup flush>
        <PanelControlRow label="Space above">
          <PanelNumber label="Space above" value={style.spaceBefore ?? 0} unit="px" min={0} max={200} flush onchange={(next) => setField("spaceBefore", next)} />
        </PanelControlRow>
        <PanelControlRow label="Space below">
          <PanelNumber label="Space below" value={style.spaceAfter ?? 0} unit="px" min={0} max={200} flush onchange={(next) => setField("spaceAfter", next)} />
        </PanelControlRow>
        <PanelControlRow label="Line height" detail="Unitless multiplier">
          <PanelNumber label="Line height" value={style.lineHeight ?? 1.3} min={0.8} max={3} step={0.05} flush onchange={(next) => setField("lineHeight", next)} />
        </PanelControlRow>
        <PanelControlRow label="Indent">
          <PanelNumber label="Indent" value={style.indent ?? 0} unit="px" min={0} max={200} flush onchange={(next) => setField("indent", next)} />
        </PanelControlRow>
      </PanelControlGroup>
    </PanelSection>
  {/if}
</Panel>
