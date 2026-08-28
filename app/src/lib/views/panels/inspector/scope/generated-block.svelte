<script lang="ts">
  import FileText from "@lucide/svelte/icons/file-text";

  import {
    Panel,
    PanelChip,
    PanelCrumbs,
    PanelField,
    PanelFields,
    PanelNote,
    PanelQuote,
    PanelRow,
    PanelSection
  } from "$authored-components/panel";
  import { context, generatedBlock } from "$capabilities/scope";
  import { viewState } from "$model/client/view-state";

  /**
   * Something written against this Context, and where it lives.
   *
   * `docs/screen-panel-views/inspector/scope/generated-block.md` is the
   * specification. It is the consequence view for an edit you are about to
   * make: changing the scope changes what this block produces next time it runs,
   * which is why *Runs* is a band rather than a footnote.
   *
   * **The prompt is quoted, not restated.** It is a person's words, carried here
   * from the block, and the panel must not read as though it wrote them.
   *
   * **Owner lookup is its own band** because it is a gap, not a value: a
   * `DerivedOutput` stores no owner pointer, so *Lives in* rests on a reverse
   * query that sometimes comes back empty.
   */
  let {
    contextId = "cx-drafts",
    blockId = "gb-outage"
  }: { contextId?: string; blockId?: string } = $props();

  const view = viewState();

  const scope = $derived(context(contextId).current);
  const block = $derived(generatedBlock(blockId).current);

  const trail = $derived([
    { label: scope.name, key: "context" },
    { label: "Knowledge" },
    { label: block.name }
  ]);
</script>

<Panel title={block.name}>
  {#snippet crumbs()}
    <PanelCrumbs
      {trail}
      onnavigate={() =>
        view.inspect("scope.context", { kind: "context", id: contextId })}
    />
  {/snippet}

  <PanelSection title="Prompt">
    <PanelQuote>{block.prompt}</PanelQuote>
  </PanelSection>

  <PanelSection title="Lives in" flush>
    <PanelRow
      title={block.resource}
      sub="{block.location} · Prompt block"
      icon={FileText}
      onselect={() =>
        view.inspect("project.resource", { kind: "resource", id: block.id })}
    />
  </PanelSection>

  <PanelSection title="Runs">
    <PanelFields>
      <PanelField label="When" stacked>{block.runs}</PanelField>
    </PanelFields>
    <PanelNote>
      What it produces is generated against this Context as it stands at that
      moment. Editing the scope edits the document, one run later.
    </PanelNote>
  </PanelSection>

  <!-- What it was bound to rather than what it says, so it arrives shut. -->
  <PanelSection title="Provenance" open={false}>
    <PanelFields>
      <PanelField label="Scope">{block.scope}</PanelField>
      <PanelField label="Model" mono>{block.model}</PanelField>
    </PanelFields>
  </PanelSection>

  <PanelSection title="Owner lookup" open={false}>
    <PanelFields>
      <PanelField label="Owner block">
        {#if block.ownerResolved}
          <PanelChip tone="success">Found</PanelChip>
        {:else}
          <PanelChip tone="attention">Not found</PanelChip>
        {/if}
      </PanelField>
    </PanelFields>
    <PanelNote tone="gap">
      A DerivedOutput stores no owner pointer, so the prompt block that owns this
      one is a reverse query. That is what gates Lives in above.
    </PanelNote>
  </PanelSection>
</Panel>
