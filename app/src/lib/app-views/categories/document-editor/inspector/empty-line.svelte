<script lang="ts">
  import {
    Panel,
    PanelBodyStyle,
    PanelCrumbs,
    PanelField,
    PanelFields,
    PanelInlineStyle,
    PanelNote,
    PanelSection,
    PanelSelect
  } from "$authored-components/panel";
  import {
    BLOCK_KINDS,
    blockTypeOps,
    formatOps,
    kindOf,
    placementOf,
    resolvedOf,
    type BlockKind,
    type HorizontalAlignment
  } from "$app-views/categories/document-editor/procedures/blocks";
  import { FILLS, INKS, orClear, orNone } from "$app-views/categories/document-editor/procedures/colours";
  import { addressOf } from "$app-views/categories/document-editor/procedures/inspecting";
  import { STYLES, blockOf, type MarkStyle } from "$app-views/categories/document-editor/procedures/marks";
  import { DEFAULT_PAGE_SETUP, layoutMetrics } from "$app-views/categories/document-editor/procedures/page-setup";
  import {
    applyStyleOps,
    ensureStylesOps,
    styleOptions,
    styleSetOf
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
  const selection = $derived(view.selection);
  const address = $derived(selection === undefined ? undefined : addressOf(selection.id));
  const block = $derived(body === undefined || address === undefined ? undefined : blockOf(body, address.blockId));

  const set = $derived(styleSetOf(body));
  const resolved = $derived(body === undefined || block === undefined ? undefined : resolvedOf(body, block));
  const metrics = $derived(layoutMetrics(body?.pageSetup ?? DEFAULT_PAGE_SETUP));
  const placement = $derived(
    body === undefined || block === undefined ? undefined : placementOf(body, block.id, metrics)
  );

  let pendingStyles = $state<string[]>([]);
  let pendingInk = $state("");
  let pendingFill = $state("");

  const commit = (ops: Parameters<DocumentRuntime["apply"]>[0]) => {
    if (ops.length > 0) runtime?.apply(ops);
  };

  const setKind = (next: string) => {
    if (body === undefined || block === undefined) return;
    const ops = blockTypeOps(body, block.id, next as BlockKind);
    if (ops.length === 0) return;
    commit(ops);

    const made = ops.find((op) => op.op === "insert" && op.target === "block");
    const id = made?.op === "insert" ? made.ids[0] : undefined;
    if (next === "table" && id !== undefined) view.inspect("document-editor.table", { kind: "table", id });
    else if (next === "image" && id !== undefined) view.inspect("document-editor.image", { kind: "image", id });
    else if (next !== "text") view.clear();
  };

  const setStyle = (key: string) => {
    if (body === undefined || block === undefined) return;
    commit([...ensureStylesOps(body), ...applyStyleOps(block, key)]);
  };

  const setFormat = (patch: Parameters<typeof formatOps>[1]) => {
    if (block === undefined) return;
    commit(formatOps(block, patch));
  };

  const setAlign = (next: HorizontalAlignment) => setFormat({ horizontalAlignment: next });

  const push = () => {
    if (runtime === undefined) return;
    runtime.pendingMarks = {
      style: pendingStyles as MarkStyle[],
      color: orClear(pendingInk),
      background: orClear(pendingFill)
    };
  };

  const setMarks = (next: string[]) => {
    pendingStyles = next;
    push();
  };

  const setInk = (next: string) => {
    pendingInk = next;
    push();
  };

  const setFill = (next: string) => {
    pendingFill = next;
    push();
  };

  const navigate = (key: string) => {
    if (isInspectorView(key)) view.inspect(key);
  };
</script>

{#snippet head(title: string)}
  <div class="text-ink-secondary flex items-center gap-1.5 px-3 py-1.5">
    <span class="text-caption font-semibold tracking-wide uppercase">{title}</span>
  </div>
{/snippet}

<Panel title="Empty line">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: "Document", key: "document-editor.document" }, { label: "Empty line" }]}
      onnavigate={navigate}
    />
  {/snippet}

  {#if block === undefined || resolved === undefined}
    <div class="pt-2">
      <PanelNote tone="muted">The line the caret was on is gone.</PanelNote>
    </div>
  {:else}
    <div class="flex flex-col gap-2 pt-2">
      {@render head("Block")}
      <div class="px-3 pb-2">
        <PanelSelect label="Block" value={kindOf(block)} options={BLOCK_KINDS} onchange={setKind} />
      </div>

      {@render head("Style")}
      <div class="flex flex-col gap-3 px-3 pb-2">
        <PanelSelect
          label="Style"
          value={block.style ?? set.defaultKey}
          options={styleOptions(set)}
          onchange={setStyle}
        />

        <button
          type="button"
          class="border-border-subtle bg-surface-panel hover:bg-surface-panel-hover rounded-control flex min-w-0 items-center gap-2 border px-2 py-1.5 text-start"
          title="Edit the named style"
          onclick={() => view.inspect("document-editor.named-style", { kind: "named-style", id: block.style ?? set.defaultKey })}
        >
          <span class="text-body-sm text-ink-primary min-w-0 flex-1 truncate">{resolved.fontFamily ?? "IBM Plex Sans"}</span>
          <span class="text-caption text-ink-muted shrink-0 tabular-nums">{resolved.fontSize ?? 16}px</span>
        </button>

        <PanelInlineStyle
          marks={pendingStyles}
          options={STYLES}
          foreground={orNone(pendingInk)}
          background={orNone(pendingFill)}
          foregroundOptions={INKS}
          backgroundOptions={FILLS}
          prefix="for the next letter"
          onmarks={setMarks}
          onforeground={setInk}
          onbackground={setFill}
        />
      </div>

      <PanelBodyStyle
        alignment={resolved.horizontalAlignment ?? "start"}
        spaceBefore={resolved.spaceBefore ?? 0}
        spaceAfter={resolved.spaceAfter ?? 0}
        lineHeight={resolved.lineHeight ?? 26}
        indent={resolved.indent ?? 0}
        onalignment={setAlign}
        onchange={(field, next) => setFormat({ [field]: next })}
      />

      {#if placement !== undefined}
        <PanelSection title="Placement" chevron="end">
          <PanelFields>
            <PanelField label="Page" mono stacked>{placement.page}</PanelField>
            <PanelField label="In row" mono stacked>{placement.index} of {placement.of}</PanelField>
          </PanelFields>
        </PanelSection>
      {/if}
    </div>
  {/if}
</Panel>
