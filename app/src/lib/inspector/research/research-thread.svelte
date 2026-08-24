<script lang="ts">
  import ArrowUpRight from "@lucide/svelte/icons/arrow-up-right";

  import {
    Panel,
    PanelActions,
    PanelButton,
    PanelChip,
    PanelCrumbs,
    PanelField,
    PanelFields,
    PanelLink,
    PanelNote,
    PanelSection
  } from "$lib/unique-components/panel";
  import { project } from "$mock-capabilities/project";
  import { thread } from "$mock-capabilities/research";
  import { isInspectionKey, viewState } from "$model/client/view-state";

  /**
   * A Research thread, selected from the project's work table.
   *
   * `docs/screen-panel-views/inspector/research/research-thread.md` is the
   * specification. A thread is work rather than a resource, which is why it is in
   * that table at all.
   *
   * **Opening it lands on the thread's own tab.** A line of enquiry is opened,
   * worked in and closed exactly as a document is, so it is keyed by its own id
   * in the strip and several can stand open beside one another.
   *
   * **The anchor's reference is its identifier.** `Q-14` is the question `q-14`
   * and `H-7` the hypothesis `h-7`, so the mode decides which lens the anchor
   * opens.
   */
  let { threadId = "th-feeder" }: { threadId?: string } = $props();

  const view = viewState();

  const record = $derived(thread(threadId).current);

  const anchorLens = $derived(
    record.mode === "Hypothesis" ? "research.hypothesis" : "research.question"
  );
  const anchorKind = $derived(record.mode === "Hypothesis" ? "hypothesis" : "question");
</script>

<Panel title={record.title}>
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[
        { label: project().current.name, key: "project.project" },
        { label: record.title }
      ]}
      onnavigate={(key) => {
        if (isInspectionKey(key)) view.inspect(key, { kind: "project", id: view.project });
      }}
    />
  {/snippet}

  <PanelSection title="Identity" flush>
    <PanelFields>
      <PanelField label="Title" stacked>{record.title}</PanelField>
      <PanelField label="Mode"><PanelChip>{record.mode}</PanelChip></PanelField>
      <!-- A Discover thread has no anchor, and an absent anchor is not an empty one. -->
      {#if record.anchor}
        {@const anchor = record.anchor}
        <PanelField label="Anchor" stacked>
          <PanelLink
            label="{anchor.ref} · {anchor.text}"
            title="Open {anchor.ref}"
            onselect={() =>
              view.inspect(anchorLens, {
                kind: anchorKind,
                id: anchor.ref.toLowerCase()
              })}
          />
        </PanelField>
      {/if}
    </PanelFields>

    <!--
      Two acts in one press: the tab it lands on opens with an empty inspector,
      and emptying the panel the reader was already in is a cost for nothing.
    -->
    <PanelActions>
      <PanelButton
        label="Open in Research"
        icon={ArrowUpRight}
        tone="primary"
        onclick={() => {
          view.open({ screen: "research", resourceId: threadId });
          view.inspect("research.thread", { kind: "thread", id: threadId });
        }}
      />
    </PanelActions>
  </PanelSection>

  <!-- Who made it and how far it has moved: context rather than the reason for opening it. -->
  <PanelSection title="Provenance" open={false} flush>
    <PanelFields>
      <PanelField label="Created by">{record.createdBy}</PanelField>
      <PanelField label="Revision" mono>{record.revision}</PanelField>
      <PanelField label="Updated">{record.updated}</PanelField>
    </PanelFields>
  </PanelSection>

  <PanelNote>
    Opening this puts the thread in the tab strip beside the documents and decks
    the same table opens, and closing that tab closes the thread.
  </PanelNote>
</Panel>
