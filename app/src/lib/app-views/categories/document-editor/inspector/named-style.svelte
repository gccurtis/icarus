<script lang="ts">
  import Copy from "@lucide/svelte/icons/copy";
  import Trash2 from "@lucide/svelte/icons/trash-2";

  import {
    Panel,
    PanelBodyStyle,
    PanelButton,
    PanelCrumbs,
    PanelEditableText,
    PanelInlineStyle,
    PanelNote,
    PanelNumber,
    PanelSelect
  } from "$authored-components/panel";
  import { FILLS, INKS, cssColour, orClear, orNone } from "$app-views/categories/document-editor/procedures/colours";
  import { STYLES, type MarkStyle } from "$app-views/categories/document-editor/procedures/marks";
  import {
    defaultStyleOps,
    deleteStyleOps,
    duplicateStyleOps,
    familyOptions,
    resolve,
    styleFieldOps,
    styleFieldsOps,
    styleSetOf,
    type TextStyle
  } from "$app-views/categories/document-editor/procedures/styles";
  import { isInspectorView, workspaceState } from "$model/client/workspace-state";
  import type { DocumentRuntime } from "$model/client/workspace-state";

  const view = workspaceState();
  const documentId = $derived(view.active.resourceId);

  let runtime = $state<DocumentRuntime | undefined>(undefined);
  $effect(() => {
    runtime = documentId === undefined ? undefined : view.documentRuntime(documentId);
  });

  const body = $derived(runtime?.body);
  const key = $derived(view.selection?.id ?? "");
  const set = $derived(styleSetOf(body));
  const style = $derived(set.styles[key]);
  const presentation = $derived(style === undefined ? undefined : resolve(set, key, undefined));
  const isDefault = $derived(set.defaultKey === key);
  const marks = $derived.by((): MarkStyle[] => {
    if (style === undefined) return [];
    return [
      ...(style.bold === true || (style.fontWeight ?? 0) >= 600 ? ["bold" as const] : []),
      ...(style.italic === true ? ["italic" as const] : []),
      ...(style.underline === true ? ["underline" as const] : []),
      ...(style.strikethrough === true ? ["strikethrough" as const] : [])
    ];
  });

  const commit = (ops: Parameters<DocumentRuntime["apply"]>[0]) => {
    if (ops.length > 0) runtime?.apply(ops);
  };

  const setField = <K extends keyof TextStyle>(field: K, value: TextStyle[K] | undefined) => {
    if (body === undefined) return;
    commit(styleFieldOps(body, key, field, value));
  };

  const setMarks = (next: string[]) => {
    if (body === undefined || style === undefined) return;
    const patch: Partial<TextStyle> = {};

    for (const { value } of STYLES) {
      const wanted = next.includes(value);
      const had = marks.includes(value);
      if (wanted === had) continue;

      if (value === "bold") {
        patch.bold = wanted ? true : undefined;
        patch.fontWeight = undefined;
      } else if (value === "italic") patch.italic = wanted ? true : undefined;
      else if (value === "underline") patch.underline = wanted ? true : undefined;
      else if (value === "strikethrough") patch.strikethrough = wanted ? true : undefined;
    }

    commit(styleFieldsOps(body, key, patch));
  };

  const rename = (name: string) => {
    if (name.trim().length > 0) setField("name", name.trim());
  };

  const duplicate = () => {
    if (body === undefined) return;
    const made = duplicateStyleOps(body, key);
    commit(made.ops);
    if (made.key !== undefined) {
      view.inspect("document-editor.named-style", { kind: "named-style", id: made.key });
    }
  };

  const remove = () => {
    if (body === undefined) return;
    commit(deleteStyleOps(body, key));
    view.selectContext("document-editor.styles");
    view.clear();
  };

  const makeDefault = () => {
    if (body !== undefined) commit(defaultStyleOps(body, key));
  };

  const navigate = (next: string) => {
    if (isInspectorView(next)) view.inspect(next);
  };
</script>

{#snippet head(title: string)}
  <div class="text-ink-secondary flex items-center gap-1.5 px-3 py-1.5">
    <span class="text-caption font-semibold tracking-wide uppercase">{title}</span>
  </div>
{/snippet}

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
    <PanelCrumbs
      trail={[{ label: "Document", key: "document-editor.document" }, { label: "Style" }]}
      onnavigate={navigate}
    />
  {/snippet}

  {#snippet actions()}
    <PanelButton
      label={isDefault ? "Default style" : "Make default"}
      tone="ghost"
      disabled={style === undefined || isDefault}
      title={isDefault ? "This is already the default style" : undefined}
      onclick={makeDefault}
    />
    <PanelButton label="Duplicate" icon={Copy} onclick={duplicate} disabled={style === undefined} />
    <PanelButton
      label="Delete"
      icon={Trash2}
      tone="danger"
      disabled={style === undefined || isDefault}
      title={isDefault ? "The default style cannot be deleted" : undefined}
      onclick={remove}
    />
  {/snippet}

  {#if style === undefined || presentation === undefined}
    <div class="pt-2"><PanelNote tone="muted">The document has no style called {key}.</PanelNote></div>
  {:else}
    <div class="flex flex-col gap-2 pt-2">
      {@render head("Style")}
      <div class="flex flex-col gap-3 px-3 pb-2">
        <div class="grid min-w-0 grid-cols-[minmax(0,1fr)_5.5rem] gap-2">
          <label class="flex min-w-0 flex-col gap-1">
            <span class="text-caption text-ink-muted">Font</span>
            <PanelSelect
              label="Font"
              value={style.fontFamily ?? "IBM Plex Sans"}
              options={familyOptions()}
              onchange={(next) => setField("fontFamily", next)}
            />
          </label>
          <label class="flex min-w-0 flex-col gap-1">
            <span class="text-caption text-ink-muted">Size</span>
            <PanelNumber
              label="Font size"
              value={style.fontSize ?? 16}
              unit="px"
              min={8}
              max={96}
              flush
              onchange={(next) => setField("fontSize", next)}
            />
          </label>
        </div>

        <PanelInlineStyle
          marks={[...marks]}
          options={STYLES}
          foreground={orNone(cssColour(style.color))}
          background={orNone(cssColour(style.background))}
          foregroundOptions={INKS}
          backgroundOptions={FILLS}
          prefix="for this style"
          onmarks={setMarks}
          onforeground={(next) => setField("color", orClear(next))}
          onbackground={(next) => setField("background", orClear(next))}
        />
      </div>

      <PanelBodyStyle
        alignment={style.horizontalAlignment ?? "start"}
        spaceBefore={style.spaceBefore ?? 0}
        spaceAfter={style.spaceAfter ?? 0}
        lineHeight={presentation.lineHeight ?? 26}
        indent={style.indent ?? 0}
        open
        onalignment={(next) => setField("horizontalAlignment", next)}
        onchange={(field, next) => setField(field, next)}
      />
    </div>
  {/if}
</Panel>
