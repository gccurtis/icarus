<script lang="ts">
  import {
    Panel,
    PanelCrumbs,
    PanelField,
    PanelFields,
    PanelNote,
    PanelQuote,
    PanelSection
  } from "$lib/unique-components/panel";
  import { context, searchHit } from "$mock-capabilities/scope";
  import { viewState } from "$model/client/view-state";

  /**
   * One result from a test search against this Context.
   *
   * `docs/screen-panel-views/inspector/scope/search-result.md` is the
   * specification. The retrieval test answers the only question that matters
   * about a scope: if an agent searched this, what would it get?
   *
   * **The passage is quoted verbatim.** It is what the retriever returned, and a
   * panel that paraphrased it would be answering a different question.
   *
   * **What was searched is carried on the result**, not read again now. A scope
   * resolves at the moment it is read, so a manifest fetched after the fact
   * would describe a different search from the one that produced this.
   */
  let {
    contextId = "cx-drafts",
    hitId = "sr-1"
  }: { contextId?: string; hitId?: string } = $props();

  const view = viewState();

  const scope = $derived(context(contextId).current);
  const hit = $derived(searchHit(hitId).current);

  const trail = $derived([
    { label: scope.name, key: "context" },
    { label: "Test search" },
    { label: hit.source }
  ]);
</script>

<Panel title={hit.source}>
  {#snippet crumbs()}
    <PanelCrumbs
      {trail}
      onnavigate={() =>
        view.inspect("scope.context", { kind: "context", id: contextId })}
    />
  {/snippet}

  <PanelSection title="What was found">
    <PanelQuote
      source={hit.source}
      sourceLabel="From"
      onopen={() =>
        view.inspect("project.resource", { kind: "resource", id: hit.id })}
    >
      {hit.passage}
    </PanelQuote>
  </PanelSection>

  <PanelSection title="Where">
    <PanelFields>
      <PanelField label="Source" stacked>{hit.source}</PanelField>
      <!-- A page only where the source has them. An absent page is not page 0. -->
      {#if hit.page !== undefined}
        <PanelField label="Page" mono>{hit.page}</PanelField>
      {/if}
      <PanelField label="Offsets" mono>{hit.offsets.from} → {hit.offsets.to}</PanelField>
    </PanelFields>
    <PanelNote tone="gap">
      Offsets are internals. They are useful for debugging retrieval and
      meaningless to anyone else; whether they belong in the product view is
      undecided.
    </PanelNote>
  </PanelSection>

  <!-- How it ranked rather than what it says, so it arrives shut. -->
  <PanelSection title="Scoring" open={false}>
    <PanelFields>
      <PanelField label="Relevance" mono>{hit.relevance.toFixed(2)}</PanelField>
      <PanelField label="Density" mono>{hit.density.toFixed(2)}</PanelField>
    </PanelFields>
  </PanelSection>

  <PanelSection title="What was searched" open={false}>
    <PanelFields>
      <PanelField label="Contents">{hit.searched.contents} resources</PanelField>
      <PanelField label="Searchable">{hit.searched.searchable} of them</PanelField>
      <PanelField label="At" mono>{hit.searched.at}</PanelField>
    </PanelFields>
    <PanelNote>
      The scope as it stood when the search ran, recorded with the result. Read
      again now it would resolve to something else, and the result would stop
      being interpretable.
    </PanelNote>
  </PanelSection>
</Panel>
