<script lang="ts">
  import {
    Panel,
    PanelAlignment,
    PanelCrumbs,
    PanelInlineStyle,
    PanelNote,
    PanelSpacing,
    PanelSelect
  } from "$authored-components/panel";
  import {
    formatOps,
    resolvedOf,
    type HorizontalAlignment
  } from "$app-views/categories/document-editor/procedures/blocks";
  import { FILLS, INKS, orClear, orNone } from "$app-views/categories/document-editor/procedures/colours";
  import { addressOf } from "$app-views/categories/document-editor/procedures/inspecting";
  import {
    STYLES,
    blockOf,
    colourAt,
    stylesAt,
    type MarkStyle
  } from "$app-views/categories/document-editor/procedures/marks";
  import { linearOf } from "$app-views/categories/document-editor/procedures/projection-atoms";
  import {
    applyStyleOps,
    ensureStylesOps,
    styleOptions,
    styleSetOf
  } from "$app-views/categories/document-editor/procedures/styles";
  import { isInspectorView, workspaceState } from "$model/client/workspace-state";
  import type { DocumentRuntime } from "$model/client/workspace-state";
  import NextLetterComments from "$app-views/categories/document-editor/components/next-letter-comments.svelte";
  import NextLetterLinks from "$app-views/categories/document-editor/components/next-letter-links.svelte";

  const view = workspaceState();

  const documentId = view.active.resourceId;

  let runtime = $state<DocumentRuntime | undefined>(undefined);

  $effect(() => {
    runtime = documentId === undefined ? undefined : view.documentRuntime(documentId);
  });

  const body = $derived(runtime?.body);
  const selection = $derived(view.selection);
  const address = $derived(selection === undefined ? undefined : addressOf(selection.id));
  const block = $derived(body === undefined || address === undefined ? undefined : blockOf(body, address.blockId));
  const at = $derived(
    block === undefined || address === undefined
      ? 0
      : linearOf(block.atoms, { atom: address.atomId, offset: address.offset })
  );

  const set = $derived(styleSetOf(body));
  const resolved = $derived(body === undefined || block === undefined ? undefined : resolvedOf(body, block));

  const carried = $derived(body === undefined || block === undefined ? [] : stylesAt(body, block.id, at));
  const tint = $derived(body === undefined || block === undefined ? {} : colourAt(body, block.id, at));

  let chosen = $state<{ styles: string[]; ink: string; fill: string } | undefined>(undefined);

  const styles = $derived(chosen?.styles ?? [...carried]);
  const ink = $derived(chosen?.ink ?? orNone(tint.color));
  const fill = $derived(chosen?.fill ?? orNone(tint.background));

  const commit = (ops: Parameters<DocumentRuntime["apply"]>[0]) => {
    if (ops.length > 0) runtime?.apply(ops);
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

  const push = (next: { styles: string[]; ink: string; fill: string }) => {
    chosen = next;
    if (runtime === undefined) return;
    runtime.pendingMarks = {
      style: next.styles as MarkStyle[],
      color: orClear(next.ink),
      background: orClear(next.fill)
    };
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

<Panel title="Next letter">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: "Document", key: "document-editor.document" }, { label: "Caret" }]}
      onnavigate={navigate}
    />
  {/snippet}

  {#if block === undefined || resolved === undefined}
    <div class="pt-2">
      <PanelNote tone="muted">The block the caret was in is gone.</PanelNote>
    </div>
  {:else}
    <div class="flex flex-col gap-2 pt-2">
      <PanelNote tone="muted">
        Inline formatting applies to what is typed next. The named style and spacing apply to the whole block.
      </PanelNote>

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
          marks={[...styles]}
          options={STYLES}
          foreground={ink}
          background={fill}
          foregroundOptions={INKS}
          backgroundOptions={FILLS}
          prefix="for the next letter"
          onmarks={(next) => push({ styles: next, ink, fill })}
          onforeground={(next) => push({ styles: [...styles], ink: next, fill })}
          onbackground={(next) => push({ styles: [...styles], ink, fill: next })}
        />
        <PanelAlignment value={resolved.horizontalAlignment ?? "start"} onchange={setAlign} />
      </div>

      <PanelSpacing
        spaceBefore={resolved.spaceBefore ?? 0}
        spaceAfter={resolved.spaceAfter ?? 0}
        lineHeight={resolved.lineHeight ?? 26}
        indent={resolved.indent ?? 0}
        onchange={(field, next) => setFormat({ [field]: next })}
      />

      <NextLetterComments />
      <NextLetterLinks />
    </div>
  {/if}
</Panel>
