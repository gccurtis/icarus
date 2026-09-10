<script lang="ts">
  import Plus from "@lucide/svelte/icons/plus";

  import { Panel, PanelButton, PanelEmpty, PanelRow, PanelSearch } from "$authored-components/panel";
  import { blocksIn } from "$app-views/categories/document-editor/procedures/marks";
  import {
    applyStyleOps,
    ensureStylesOps,
    newStyleOps,
    shorthand,
    styleSetOf
  } from "$app-views/categories/document-editor/procedures/styles";
  import { workspaceState } from "$model/client/workspace-state";
  import type { DocumentRuntime } from "$model/client/workspace-state";

  const view = workspaceState();

  const documentId = view.active.resourceId;

  let runtime = $state<DocumentRuntime | undefined>(undefined);

  $effect(() => {
    runtime = documentId === undefined ? undefined : view.documentRuntime(documentId);
  });

  let query = $state("");

  const body = $derived(runtime?.body);
  const set = $derived(styleSetOf(body));
  const entries = $derived(Object.entries(set.styles).map(([key, style]) => ({ key, style })));
  const shown = $derived(
    entries.filter(({ style }) => style.name.toLowerCase().includes(query.trim().toLowerCase()))
  );
  const targets = $derived(blocksIn(body, view.selection));
  const inspected = $derived(
    view.inspected === "document-editor.named-style" ? view.selection?.id : undefined
  );

  const commit = (ops: Parameters<DocumentRuntime["apply"]>[0]) => {
    if (ops.length > 0) runtime?.apply(ops);
  };

  const open = (key: string) => view.inspect("document-editor.named-style", { kind: "named-style", id: key });

  const apply = (key: string) => {
    if (body === undefined) return;
    commit([...ensureStylesOps(body), ...targets.flatMap((block) => applyStyleOps(block, key))]);
  };

  const add = () => {
    if (body === undefined) return;
    const made = newStyleOps(body);
    commit(made.ops);
    open(made.key);
  };
</script>

<Panel title="Styles">
  {#snippet actions()}
    <PanelButton label="New style" icon={Plus} disabled={body === undefined} onclick={add} />
  {/snippet}

  {#if body === undefined}
    <PanelEmpty title="Open a document to see its styles" />
  {:else}
    <PanelSearch
      placeholder="Filter styles…"
      matched={shown.length}
      total={entries.length}
      flush
      bind:value={query}
    >
      {#each shown as entry (entry.key)}
        <PanelRow
          title={entry.style.name}
          sub={shorthand(entry.style)}
          selected={inspected === entry.key}
          onselect={() => open(entry.key)}
        >
          {#snippet control()}
            <PanelButton
              label="Apply"
              tone="ghost"
              disabled={targets.length === 0}
              title={targets.length === 0 ? "Put the caret in a block first" : `Apply ${entry.style.name} to the selection`}
              onclick={() => apply(entry.key)}
            />
          {/snippet}
        </PanelRow>
      {/each}
    </PanelSearch>
  {/if}
</Panel>
