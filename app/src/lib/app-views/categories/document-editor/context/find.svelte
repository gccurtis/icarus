<script lang="ts">
  import {
    Panel,
    PanelButton,
    PanelInput,
    PanelNote,
    PanelRow,
    PanelSearch,
    PanelSelect,
    PanelToggle
  } from "$authored-components/panel";
  import {
    addressOfHit,
    hitsOf,
    replaceAllOps,
    replaceOps,
    type Hit
  } from "$app-views/categories/document-editor/procedures/find";
  import { workspaceState } from "$model/client/workspace-state";
  import type { DocumentRuntime } from "$model/client/workspace-state";

  const MODES = [
    { value: "find", label: "Find" },
    { value: "replace", label: "Find and replace" }
  ];

  const view = workspaceState();

  const documentId = $derived(view.active.resourceId);

  let runtime = $state<DocumentRuntime | undefined>(undefined);

  $effect(() => {
    runtime = documentId === undefined ? undefined : view.documentRuntime(documentId);
  });

  let query = $state("");
  let replacement = $state("");
  let mode = $state("find");
  let caseSensitive = $state(false);

  const body = $derived(runtime?.body);
  const hits = $derived(hitsOf(body, query, caseSensitive));
  const selected = $derived(view.selection?.id);

  const commit = (ops: Parameters<DocumentRuntime["apply"]>[0]) => {
    if (ops.length > 0) runtime?.apply(ops);
  };

  const show = (hit: Hit) => {
    if (runtime === undefined) return;
    runtime.scrollTo = hit.blockId;
    view.inspect("document-editor.text-selection", {
      kind: "text-selection",
      id: addressOfHit(hit, "from"),
      at: addressOfHit(hit, "to")
    });
  };

  const replaceOne = (hit: Hit) => commit(replaceOps(hit, replacement));
  const replaceEvery = () => commit(replaceAllOps(hits, replacement));
</script>

<Panel title="Find">
  <div class="flex flex-col gap-2 px-3 pb-2">
    <PanelSelect label="Mode" value={mode} options={MODES} onchange={(next) => (mode = next)} />
    <PanelToggle label="Match case" checked={caseSensitive} onchange={(next) => (caseSensitive = next)} />
  </div>

  {#if mode === "replace"}
    <div class="flex flex-col gap-2 px-3 pb-2">
      <PanelInput label="Replace with" placeholder="Replace with…" flush bind:value={replacement} />
      <div class="flex">
        <PanelButton label="Replace all ({hits.length})" tone="primary" disabled={hits.length === 0} onclick={replaceEvery} />
      </div>
    </div>
  {/if}

  <PanelSearch
    placeholder="Find in the document…"
    matched={query.length === 0 ? undefined : hits.length}
    empty={query.length === 0 ? "Type to search the document." : "Nothing matches."}
    flush
    bind:value={query}
  >
    {#if query.length === 0}
      <PanelNote tone="muted">Matches list here with the words around them.</PanelNote>
    {/if}
    {#each hits as hit (hit.id)}
      <PanelRow
        title={hit.match}
        sub={`…${hit.before}[${hit.match}]${hit.after}…`}
        selected={selected === addressOfHit(hit, "from")}
        onselect={() => show(hit)}
      >
        {#snippet control()}
          {#if mode === "replace"}
            <PanelButton label="Replace" tone="ghost" onclick={() => replaceOne(hit)} />
          {/if}
        {/snippet}
      </PanelRow>
    {/each}
  </PanelSearch>
</Panel>
