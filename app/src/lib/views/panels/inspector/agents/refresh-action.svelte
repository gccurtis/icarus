<script lang="ts">
  import {
    Panel,
    PanelCrumbs,
    PanelField,
    PanelFields,
    PanelLink,
    PanelNote,
    PanelQuote,
    PanelSection
  } from "$authored-components/panel";
  import {
    actionsFor,
    automation,
    lastFireOf,
    type ActionOption,
    type GeneratedBlock
  } from "$capabilities/agents";
  import { isInspectionKey, viewState } from "$model/client/view-state";

  /**
   * Re-run a generated block: which block, and what re-running it actually does.
   *
   * `docs/screen-panel-views/inspector/agents/refresh-action.md` is the
   * specification. The block already runs when its resource is opened, so this
   * is not a fix for staleness — nothing in this application is stale. It is for
   * having the answer ready before anyone looks.
   *
   * **A re-run leaves no run record of its own.** This Automation's last fire
   * and the block's own provenance are the whole of what is kept.
   */
  let {
    automationId = "outage-summary",
    blockId = "block-outage-summary"
  }: { automationId?: string; blockId?: string } = $props();

  const view = viewState();

  const rule = $derived(automation(automationId).current);

  type RefreshBlock = Extract<ActionOption, { kind: "refresh-block" }>;
  const isRefresh = (option: ActionOption): option is RefreshBlock =>
    option.kind === "refresh-block";

  const action = $derived(actionsFor(automationId).current.find(isRefresh));
  const blocks = $derived(action?.blocks ?? []);
  const block = $derived(
    blocks.find((candidate: GeneratedBlock) => candidate.id === blockId) ?? blocks[0]
  );

  const fire = $derived(lastFireOf(automationId).current);
</script>

<Panel title={block.name}>
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[
        { label: rule.name, key: "agents.automation" },
        { label: "Do this" },
        { label: block.name }
      ]}
      onnavigate={(key: string) => {
        if (isInspectionKey(key)) view.inspect(key, { kind: "automation", id: automationId });
      }}
    />
  {/snippet}

  <PanelSection title="Block" flush>
    <!-- The prompt is what the block asks for, verbatim, so it is quoted and
         carries the way back to where it lives. -->
    <PanelQuote
      source="{block.resource} · {block.location}"
      sourceLabel="Lives in"
      onopen={() => view.inspect("resource.prompt-block", { kind: "block", id: block.id })}
    >
      {block.prompt}
    </PanelQuote>

    <PanelNote tone="gap">
      Where it lives is a reverse query. The generated output stores no pointer
      back to the block that owns it, so this can come back empty.
    </PanelNote>
  </PanelSection>

  <PanelSection title="What re-running does" flush>
    <PanelNote>
      The block runs when its resource is opened. Re-running is for when the
      answer should be ready before anyone looks.
    </PanelNote>
    <PanelNote>It is not a fix for staleness. Nothing in this application is stale.</PanelNote>
  </PanelSection>

  <PanelSection title="Record" flush>
    <PanelFields>
      <PanelField label="Last fire">
        <PanelLink
          label="{fire.result} · {fire.when}"
          title="Open the last fire"
          onselect={() =>
            view.inspect("agents.last-fired", { kind: "automation", id: automationId })}
        />
      </PanelField>
    </PanelFields>

    <PanelNote>
      A re-run leaves no run record of its own — only this rule's last fire and
      the block's own provenance.
    </PanelNote>
    <PanelNote tone="gap">
      Which means two re-runs and two hundred are indistinguishable afterwards.
      Acceptable while there is no run table; worth revisiting when there is.
    </PanelNote>
  </PanelSection>
</Panel>
