<script lang="ts">
  import {
    Panel,
    PanelChip,
    PanelCode,
    PanelCrumbs,
    PanelField,
    PanelFields,
    PanelNote,
    PanelSection
  } from "$components/authored/panel";
  import { thread, toolCall } from "$capabilities/research";
  import { isInspectionKey, viewState } from "$model/client/view-state";

  /**
   * One step the agent took: what it asked for, and what came back.
   *
   * `docs/screen-panel-views/inspector/research/tool-call.md` is the
   * specification. It is the lowest level the Research screen goes to, and it
   * exists so a weak answer can be diagnosed rather than argued with.
   *
   * **The resolved scope is recorded on the call.** That is where historical
   * scope truthfully lives — the thread's scope can be edited afterwards, and
   * then it no longer describes the search that produced this.
   *
   * **A call that found nothing is an outcome, not an error**, so it is toned as
   * attention rather than danger and the panel says why.
   */
  let {
    callId = "tc-31",
    threadId = "th-feeder"
  }: { callId?: string; threadId?: string } = $props();

  const view = viewState();

  const record = $derived(toolCall(callId).current);
  const origin = $derived(thread(threadId).current);

  const OUTCOME = {
    Success: "success",
    "Nothing found": "attention",
    Failed: "danger"
  } as const;
</script>

<Panel title={record.name}>
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[
        { label: origin.title, key: "research.thread" },
        { label: "Trace" },
        { label: record.name }
      ]}
      onnavigate={(key) => {
        if (isInspectionKey(key)) view.inspect(key, { kind: "thread", id: threadId });
      }}
    />
  {/snippet}

  <PanelSection title="Call" flush>
    <PanelFields>
      <PanelField label="Tool" mono>{record.name}</PanelField>
      <PanelField label="State">
        <PanelChip tone={OUTCOME[record.outcome]}>{record.outcome}</PanelChip>
      </PanelField>
      <PanelField label="Duration" mono>{record.duration}</PanelField>
    </PanelFields>

    {#if record.outcome === "Nothing found"}
      <PanelNote>
        Nothing found is an outcome rather than a failure, and it is usually the
        most informative row on the screen when a turn produced a weak answer.
      </PanelNote>
    {/if}
  </PanelSection>

  <PanelSection title="Input" flush>
    <!-- The arguments as stored, unrendered: what was sent, not a reading of it. -->
    <PanelCode>{record.input}</PanelCode>

    <PanelNote tone="gap">
      Raw JSON is honest and unreadable. Whether this is rendered or shown as
      stored is a review question — the query and the scope are the two parts
      anyone actually reads.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Output" open={false} flush>
    <PanelFields>
      <PanelField label="Result" stacked>{record.result}</PanelField>
      <PanelField label="Resolved scope" stacked mono>{record.resolvedScope}</PanelField>
    </PanelFields>

    <PanelNote>
      The scope and manifest recorded here are the ones this call actually
      resolved. The thread's scope can be edited afterwards; this cannot.
    </PanelNote>
  </PanelSection>
</Panel>
