<script lang="ts">
  import CircleCheck from "@lucide/svelte/icons/circle-check";
  import CircleSlash from "@lucide/svelte/icons/circle-slash";
  import CircleX from "@lucide/svelte/icons/circle-x";

  import { Panel, PanelNote, PanelRow, PanelSection } from "$lib/unique-components/panel";
  import { traceIn, type ToolCall } from "$mock-capabilities/research";
  import { mockWorkbench } from "$mock-models/workbench.svelte";

  /**
   * How the answers were arrived at: the agent's steps, grouped by turn, newest
   * first.
   *
   * `docs/screen-panel-views/context/research/trace.md` is the specification.
   * "Why did it say that" is asked of one turn, so the turns are the sections and
   * only the current one is open — the earlier ones qualify the answer rather
   * than being the reason anyone opened this.
   *
   * **A call that found nothing is an outcome, not an error.** It carries the
   * attention tone and says the words, because it is the most informative row on
   * the screen when a turn produced a weak answer.
   */
  let { threadId = "th-feeder" }: { threadId?: string } = $props();

  const turns = $derived(traceIn(threadId).current);

  const ICON = { Success: CircleCheck, "Nothing found": CircleSlash, Failed: CircleX };

  const TONE: Record<ToolCall["outcome"], "success" | "attention" | "danger"> = {
    Success: "success",
    "Nothing found": "attention",
    Failed: "danger"
  };
</script>

<Panel title="Trace">
  {#each turns as turn, index (turn.turnId)}
    <PanelSection title={turn.heading} count={turn.calls.length} open={index === 0} flush>
      {#each turn.calls as call (call.id)}
        <PanelRow
          title={call.name}
          sub="{call.outcome} · {call.result}"
          meta={call.duration}
          icon={ICON[call.outcome]}
          tone={TONE[call.outcome]}
          onselect={() =>
            mockWorkbench.inspect("research.tool-call", { kind: "tool-call", id: call.id })}
        >
          <!-- A tool name is an identifier, so it is set as one. -->
          <span class="text-body-sm text-ink-primary truncate font-mono">{call.name}</span>
        </PanelRow>
      {/each}
    </PanelSection>
  {/each}

  <PanelNote>
    Nothing found is a result the agent got, not a failure it had. A weak answer is
    usually explained by one of these rows rather than by the prompt above it.
  </PanelNote>
</Panel>
