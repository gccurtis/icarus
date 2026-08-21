<script lang="ts">
  import ExternalLink from "@lucide/svelte/icons/external-link";
  import FileText from "@lucide/svelte/icons/file-text";

  import {
    Panel,
    PanelActions,
    PanelButton,
    PanelCrumbs,
    PanelField,
    PanelFields,
    PanelNote,
    PanelQuote,
    PanelRow,
    PanelSection
  } from "$lib/unique-components/panel";
  import { source, thread } from "$mock-capabilities/research";
  import { mockWorkbench } from "$mock-models/workbench.svelte";

  /**
   * Something that was read, and the passage that mattered.
   *
   * `docs/screen-panel-views/inspector/research/source.md` is the specification.
   * The excerpt is high in the panel because it is the reason the source is
   * listed at all — the title and the locator only say where to find it again.
   *
   * **Scores are tool output, not source fields.** They appear only where the
   * retriever supplied them, and the section says why a web source has none
   * rather than drawing an empty pair.
   */
  let {
    sourceId = "s-relay",
    threadId = "th-feeder"
  }: { sourceId?: string; threadId?: string } = $props();

  const record = $derived(source(sourceId).current);
  const origin = $derived(thread(threadId).current);
</script>

<Panel title={record.title}>
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[
        { label: origin.title, key: "research.thread" },
        { label: "Sources" },
        { label: record.title }
      ]}
      onnavigate={(key) => mockWorkbench.inspect(key, { kind: "thread", id: threadId })}
    />
  {/snippet}

  <PanelSection title="Source" flush>
    <PanelFields>
      <PanelField label="Title" stacked>{record.title}</PanelField>
      <PanelField label="Kind">{record.kind}</PanelField>
      <PanelField label="Locator" mono>{record.locator}</PanelField>
      <!--
        Web only. A URL stops being the source the moment the page changes, so
        the capture time is part of what identifies this one.
      -->
      {#if record.capturedAt}
        <PanelField label="Captured" mono>{record.capturedAt}</PanelField>
      {/if}
    </PanelFields>
  </PanelSection>

  <PanelSection title="Excerpt" flush>
    <PanelQuote
      source="{record.title} · {record.locator}"
      sourceLabel="From"
      onopen={() =>
        mockWorkbench.inspect("project.resource", { kind: "resource", id: record.id })}
    >
      {record.excerpt}
    </PanelQuote>
  </PanelSection>

  <PanelSection title="Retrieval detail" open={false} flush>
    {#if record.scores}
      {@const scores = record.scores}
      <PanelFields>
        <PanelField label="Relevance" mono>{scores.relevance.toFixed(2)}</PanelField>
        <PanelField label="Density" mono>{scores.density.toFixed(2)}</PanelField>
      </PanelFields>
      <PanelNote>
        These come from the retrieval tool rather than from the source, which is
        why a web result has none.
      </PanelNote>
    {:else}
      <PanelNote>
        The tool that produced this one scored nothing. Scores are retrieval
        output, and a web result never carries them.
      </PanelNote>
    {/if}
  </PanelSection>

  <PanelSection title="Used by" count={record.usedBy.length} open={false} flush>
    {#each record.usedBy as use (use)}
      <PanelRow title={use} />
    {/each}

    <PanelNote tone="gap">
      These are read backwards from the answers and findings citing this source.
      There is no stored link to follow yet, so no row here opens anything.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Actions" flush>
    <PanelActions>
      {#if record.kind === "Web"}
        <!--
          A web source has no resource behind it, so the control that would open
          one is absent rather than drawn and dead.
        -->
        <PanelButton
          label="Open URL"
          icon={ExternalLink}
          title="A web source has only a URL — the captured page is a third thing again"
          disabled
        />
      {:else}
        <PanelButton
          label="Open resource"
          icon={FileText}
          onclick={() =>
            mockWorkbench.inspect("project.resource", { kind: "resource", id: record.id })}
        />
      {/if}
    </PanelActions>

    <PanelNote tone="gap">
      A web source has no resource to open, only a URL, and a captured page is a
      third thing again. Which of the three a click should reach is undecided.
    </PanelNote>
  </PanelSection>
</Panel>
