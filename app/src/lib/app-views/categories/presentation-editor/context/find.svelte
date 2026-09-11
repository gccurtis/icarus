<script lang="ts">
  import { Panel, PanelButton, PanelChoice, PanelEmpty, PanelInput, PanelRow, PanelSearch } from "$authored-components/panel";
  import type { PresentationBody, TextBlock } from "$app-views/categories/presentation-editor/procedures/presentation-types";
  import { placedOn } from "$app-views/categories/presentation-editor/procedures/presentation-placement";
  import { textOf, type EditableTextBlock } from "$app-views/categories/presentation-editor/procedures/presentation-reading";
  import { notesBlock } from "$app-views/categories/presentation-editor/procedures/presentation-slides";
  import { elementsSignal, textSignal } from "$app-views/categories/presentation-editor/procedures/selecting";
  import { replaced } from "$app-views/categories/presentation-editor/procedures/typing";
  import { workspaceState, type PresentationRuntime } from "$model/client/workspace-state";

  const MODES = [
    { value: "find", label: "Find" },
    { value: "replace", label: "Replace" }
  ];

  const SCOPES = [
    { value: "all", label: "All" },
    { value: "slides", label: "Slides" },
    { value: "notes", label: "Notes" }
  ];

  type Hit = {
    readonly key: string;
    readonly slideId: string;
    readonly position: number;
    readonly source: "Text" | "Shape" | "Table" | "Notes";
    readonly elementId?: string;
    readonly block: EditableTextBlock;
    readonly at: number;
  };

  const view = workspaceState();
  const presentationId = view.active.resourceId;
  let runtime = $state<PresentationRuntime | undefined>(undefined);

  $effect(() => {
    runtime = presentationId === undefined ? undefined : view.presentationRuntime(presentationId);
  });

  const body = $derived(runtime?.body);

  let mode = $state("find");
  let scope = $state("all");
  let query = $state("");
  let replacement = $state("");
  let cursor = $state(0);

  const blocksOf = (presentation: PresentationBody): Omit<Hit, "at" | "key">[] => {
    const out: Omit<Hit, "at" | "key">[] = [];
    presentation.slides.forEach((slide, position) => {
      if (scope !== "notes") {
        for (const { element } of placedOn(slide)) {
          const block = textOf(element);
          if (block) out.push({ slideId: slide.id, position, source: element.content.type === "shape" ? "Shape" : "Text", elementId: element.id, block });
          if (element.content.type === "table") {
            for (const row of element.content.block.rows) {
              for (const cell of row.cells) {
                const held = cell.blocks.find((candidate): candidate is TextBlock => candidate.type === "text");
                if (held) out.push({ slideId: slide.id, position, source: "Table", elementId: element.id, block: held });
              }
            }
          }
        }
      }
      if (scope !== "slides") {
        const notes = notesBlock(slide);
        if (notes) out.push({ slideId: slide.id, position, source: "Notes", block: notes });
      }
    });
    return out;
  };

  const hits = $derived.by((): Hit[] => {
    const needle = query.trim().toLowerCase();
    if (body === undefined || needle === "") return [];
    const out: Hit[] = [];
    for (const held of blocksOf(body)) {
      const hay = held.block.display.toLowerCase();
      let at = hay.indexOf(needle);
      while (at !== -1) {
        out.push({ ...held, at, key: `${held.block.id}@${at}` });
        at = hay.indexOf(needle, at + Math.max(1, needle.length));
      }
    }
    return out;
  });

  const total = $derived(body === undefined ? 0 : blocksOf(body).length);

  $effect(() => {
    void hits.length;
    cursor = 0;
  });

  const snippet = (hit: Hit): string => {
    const start = Math.max(0, hit.at - 24);
    const end = Math.min(hit.block.display.length, hit.at + query.length + 32);
    return `${start > 0 ? "…" : ""}${hit.block.display.slice(start, end).replace(/\n/g, " ")}${end < hit.block.display.length ? "…" : ""}`;
  };

  const open = (hit: Hit, index: number) => {
    if (presentationId === undefined || body === undefined) return;
    cursor = index;
    view.open({ category: "presentation-editor", resourceId: presentationId, focus: hit.slideId });
    if (hit.source === "Notes") {
      view.inspect("presentation-editor.speaker-notes", { kind: "notes", id: hit.slideId });
      return;
    }
    const element = hit.elementId === undefined ? undefined : placedOn(body.slides.find((held) => held.id === hit.slideId)!).find((held) => held.element.id === hit.elementId)?.element;
    const signal = element ? elementsSignal([element]) : undefined;
    if (signal) view.inspect(signal.key, signal.selection);
    const range = textSignal(hit.block.id, hit.at, hit.at + query.length);
    view.inspect(range.key, range.selection);
  };

  const replaceOne = () => {
    const hit = hits[cursor];
    if (hit === undefined) return;
    runtime?.apply(replaced(hit.block, hit.at, hit.at + query.length, replacement));
  };

  const replaceAll = () => {
    if (body === undefined) return;
    const byBlock = new Map<string, Hit[]>();
    for (const hit of hits) byBlock.set(hit.block.id, [...(byBlock.get(hit.block.id) ?? []), hit]);
    const ops = [];
    for (const group of byBlock.values()) {
      for (const hit of [...group].sort((a, b) => b.at - a.at)) ops.push(...replaced(hit.block, hit.at, hit.at + query.length, replacement));
    }
    if (ops.length > 0) runtime?.apply(ops);
  };
</script>

<Panel title="Find">
  {#snippet actions()}
    <PanelChoice label="Mode" value={mode} options={MODES} flush fill onchange={(value) => (mode = value)} />
  {/snippet}

  {#if body}
    <PanelSearch
      placeholder="Search this presentation…"
      bind:value={query}
      matched={query.trim() === "" ? undefined : hits.length}
      total={query.trim() === "" ? undefined : total}
      empty="Nothing in this presentation matches."
      flush
    >
      {#if mode === "replace"}
        <div class="flex flex-col gap-1.5 px-3 pb-1.5">
          <PanelInput label="Replace with" placeholder="Replace with…" bind:value={replacement} flush onenter={replaceOne} />
          <div class="flex flex-wrap gap-1">
            <PanelButton label="Replace" disabled={hits.length === 0} title="Replace the highlighted hit" onclick={replaceOne} />
            <PanelButton label="Replace all" tone="primary" disabled={hits.length === 0} onclick={replaceAll} />
          </div>
        </div>
      {/if}
      <div class="px-3 pb-1.5"><PanelChoice label="Scope" value={scope} options={SCOPES} flush fill onchange={(value) => (scope = value)} /></div>
      {#each hits as hit, index (hit.key)}
        <PanelRow title="Slide {hit.position + 1} · {hit.source}" sub={snippet(hit)} selected={index === cursor && mode === "replace"} onselect={() => open(hit, index)} />
      {/each}
    </PanelSearch>
  {:else}
    <PanelEmpty title="Open a presentation to search it" />
  {/if}
</Panel>
