<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import MessagesSquare from "@lucide/svelte/icons/messages-square";
  import Plus from "@lucide/svelte/icons/plus";

  import { Panel, PanelButton, PanelEmpty, PanelRow, PanelSkeleton } from "$authored-components/panel";
  import {
    chosenThread,
    createThread,
    messageOf,
    openThread,
    threadList
  } from "$app-views/categories/research/procedures/chat.svelte";
  import { since } from "$app-views/categories/research/procedures/time";
  import { workspaceState } from "$model/client/workspace-state";

  const view = workspaceState();
  const list = threadList();
  const threads = $derived(list.ready ? list.current.threads : []);
  const open = $derived(chosenThread(view, threads));

  let now = $state(Date.now());
  let live = true;
  onDestroy(() => {
    live = false;
  });
  onMount(() => {
    const timer = setInterval(() => (now = Date.now()), 10_000);
    return () => clearInterval(timer);
  });

  let pending = $state(false);
  const start = async () => {
    pending = true;
    try {
      const made = await createThread(view);
      if (live) openThread(view, made.threadId);
    } catch (error) {
      if (live) console.error(messageOf(error));
    } finally {
      if (live) pending = false;
    }
  };
</script>

<Panel title="Threads">
  {#snippet actions()}
    <PanelButton label="New" icon={Plus} tone="primary" disabled={pending} onclick={start} />
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
        meta={since(thread.updatedAt, now)}
        icon={MessagesSquare}
        selected={thread.id === open}
        tone={thread.id === open ? "intelligence" : "default"}
        onselect={() => openThread(view, thread.id)}
      />
    {/each}
  {/if}
</Panel>
