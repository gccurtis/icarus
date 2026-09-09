<script lang="ts">
  import CornerDownRight from "@lucide/svelte/icons/corner-down-right";

  import { Panel, PanelEmpty, PanelSkeleton, PanelRow } from "$authored-components/panel";
  import {
    chosenThread,
    currentTurn,
    threadDetail,
    threadList
  } from "$app-views/categories/research/procedures/chat";
  import { startClock } from "$app-views/categories/research/procedures/effects/clock.svelte";
  import { inspectTurn } from "$app-views/categories/research/procedures/inspect-turn";
  import { since } from "$app-views/categories/research/procedures/time";
  import { workspaceState } from "$model/client/workspace-state";

  const view = workspaceState();
  const list = threadList();
  const threads = $derived(list.ready ? list.current.threads : []);
  const threadId = $derived(chosenThread(view, threads));
  const detail = $derived(threadDetail(threadId));
  const answer = $derived(detail !== undefined && detail.ready ? detail.current : undefined);
  const turns = $derived([...(answer?.turns ?? [])].reverse());
  const latest = $derived(currentTurn(answer?.turns ?? []));
  const shown = $derived(view.selection?.kind === "turn" ? view.selection.id : latest?.id);

  const clock = startClock();

  const TONE = {
    queued: "attention",
    running: "attention",
    answered: "default",
    insufficient: "attention",
    failed: "danger",
    cancelled: "default"
  } as const;

  const SUB = {
    queued: "Waiting",
    running: "Reading the project",
    answered: "",
    insufficient: "Nothing found",
    failed: "Did not finish",
    cancelled: "Cancelled"
  } as const;
</script>

<Panel title={answer?.thread.title ?? "Turns"}>
  {#if !list.ready || (threadId !== undefined && detail !== undefined && !detail.ready)}
    <PanelSkeleton shape="rows" count={4} />
  {:else if turns.length === 0}
    <PanelEmpty title="Nothing asked in this chat yet." />
  {:else}
    {#each turns as turn (turn.id)}
      <PanelRow
        title={turn.prompt}
        sub={SUB[turn.state] === ""
          ? `${turn.sources.length} source${turn.sources.length === 1 ? "" : "s"}`
          : SUB[turn.state]}
        meta={since(turn.askedAt, clock.now)}
        icon={CornerDownRight}
        tone={TONE[turn.state]}
        selected={turn.id === shown}
        onselect={() => inspectTurn(view, turn.id)}
      />
    {/each}
  {/if}
</Panel>
