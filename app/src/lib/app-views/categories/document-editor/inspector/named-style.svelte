<script lang="ts">
  import Copy from "@lucide/svelte/icons/copy";
  import Trash2 from "@lucide/svelte/icons/trash-2";

  import {
    Panel,
    PanelBodyStyle,
    PanelButton,
    PanelCrumbs,
    PanelEditableText,
    PanelField,
    PanelFields,
    PanelNote,
    PanelNumber,
    PanelSection,
    PanelSelect,
    PanelToggle
  } from "$authored-components/panel";
  import {
    WEIGHTS,
    defaultStyleOps,
    deleteStyleOps,
    duplicateStyleOps,
    familyOptions,
    shorthand,
    styleFieldOps,
    styleSetOf,
    usageOf
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
  const isDefault = $derived(set.defaultKey === key);
  const usage = $derived(body === undefined ? 0 : usageOf(body, key));

  const commit = (ops: Parameters<DocumentRuntime["apply"]>[0]) => {
    if (ops.length > 0) runtime?.apply(ops);
  };

  const setField = <K extends keyof NonNullable<typeof style>>(
    field: K,
    value: NonNullable<typeof style>[K] | undefined
  ) => {
    if (body === undefined) return;
    commit(styleFieldOps(body, key, field, value));
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
    if (body === undefined) return;
    commit(defaultStyleOps(body, key));
  };

  const navigate = (next: string) => {
    if (isInspectorView(next)) view.inspect(next);
  };
</script>

<Panel title={style?.name ?? "Style"}>
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: "Document", key: "document-editor.document" }, { label: "Style" }]}
      onnavigate={navigate}
    />
  {/snippet}

  {#snippet actions()}
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

  {#if style === undefined}
    <div class="pt-2">
      <PanelNote tone="muted">The document has no style called {key}.</PanelNote>
    </div>
  {:else}
    <PanelSection title="Identity">
      <PanelFields>
        <PanelField label="Name" stacked>
          <PanelEditableText label="Name" value={style.name} onchange={(next) => setField("name", next)} />
        </PanelField>
        <PanelField label="Key" mono stacked>{key}</PanelField>
        <PanelField label="Reads as" stacked>{shorthand(style)}</PanelField>
      </PanelFields>
      <div class="flex items-center gap-2 pt-1">
        {#if isDefault}
          <span class="text-caption text-ink-muted">This is the default style.</span>
        {:else}
          <PanelButton label="Make default" tone="ghost" onclick={makeDefault} />
        {/if}
      </div>
    </PanelSection>

    <PanelSection title="Typography">
      <div class="grid min-w-0 grid-cols-[minmax(0,1fr)_5.5rem] gap-2 px-3">
        <label class="flex min-w-0 flex-col gap-1">
          <span class="text-caption text-ink-muted">Typeface</span>
          <PanelSelect
            label="Font"
            value={style.fontFamily ?? "IBM Plex Sans"}
            options={familyOptions()}
            onchange={(next) => setField("fontFamily", next)}
          />
        </label>
        <label class="flex min-w-0 flex-col gap-1">
          <span class="text-caption text-ink-muted">Size</span>
          <PanelNumber label="Font size" value={style.fontSize ?? 16} unit="px" min={8} max={96} flush onchange={(next) => setField("fontSize", next)} />
        </label>
      </div>
      <PanelFields>
        <PanelField label="Weight" stacked>
          <PanelSelect
            label="Weight"
            value={String(style.fontWeight ?? (style.bold === true ? 700 : 400))}
            options={WEIGHTS}
            onchange={(next) => setField("fontWeight", Number(next))}
          />
        </PanelField>
        <PanelField label="Italic" stacked>
          <PanelToggle label="Italic" checked={style.italic === true} onchange={(next) => setField("italic", next ? true : undefined)} />
        </PanelField>
      </PanelFields>
    </PanelSection>

    <PanelBodyStyle
      alignment={style.horizontalAlignment ?? "start"}
      spaceBefore={style.spaceBefore ?? 0}
      spaceAfter={style.spaceAfter ?? 0}
      lineHeight={style.lineHeight ?? 26}
      indent={style.indent ?? 0}
      open
      onalignment={(next) => setField("horizontalAlignment", next)}
      onchange={(field, next) => setField(field, next)}
    />

    <PanelSection title="Usage">
      <PanelFields>
        <PanelField label="Blocks" mono stacked>{usage}</PanelField>
      </PanelFields>
    </PanelSection>
  {/if}
</Panel>
