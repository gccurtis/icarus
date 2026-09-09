<script lang="ts">
  import MessagesSquare from "@lucide/svelte/icons/messages-square";
  import Plus from "@lucide/svelte/icons/plus";

  import { Panel, PanelButton, PanelEmpty, PanelRow, PanelSkeleton } from "$authored-components/panel";
  import {
    chosenThread,
    openThread,
    threadList,
    type Working
  } from "$app-views/categories/research/procedures/chat";
  import { createThread } from "$app-views/categories/research/procedures/create-thread";
  import { startClock } from "$app-views/categories/research/procedures/effects/clock.svelte";
  import { releaseWhenGone } from "$app-views/categories/research/procedures/effects/mounted.svelte";
  import { since } from "$app-views/categories/research/procedures/time";
  import { workspaceState } from "$model/client/workspace-state";

  const view = workspaceState();
  const list = threadList();
  const threads = $derived(list.ready ? list.current.threads : []);
  const open = $derived(chosenThread(view, threads));

  const clock = startClock();
  const surface: Working = $state({ mounted: true, pending: false, failure: undefined });
  releaseWhenGone(surface);
</script>

<Panel title="Threads">
  {#snippet actions()}
    <PanelButton
      label="New"
      icon={Plus}
      tone="primary"
      disabled={surface.pending}
      onclick={() => createThread(view, surface)}
    />
  {/snippet}

  {#if !list.ready}
    <PanelSkeleton shape="rows" count={5} />
  {:else if threads.length === 0}
    <PanelEmpty title="No chats yet." />
  {:else}
    {#each threads as thread (thread.id)}
      <PanelRow
        title={thread.title}
        sub={thread.turnCount === 0
          ? "Nothing asked yet"
          : `${thread.turnCount} turn${thread.turnCount === 1 ? "" : "s"}`}
        meta={since(thread.updatedAt, clock.now)}
        icon={MessagesSquare}
        selected={thread.id === open}
        tone={thread.id === open ? "intelligence" : "default"}
        onselect={() => openThread(view, thread.id)}
      />
    {/each}
  {/if}
</Panel>
