<script lang="ts">
  import MessageSquare from "@lucide/svelte/icons/message-square";

  import { read } from "$capabilities/store/index.remote";
  import { PanelButton } from "$authored-components/panel";
  import { threadsSignal } from "$app-views/categories/slide-deck-editor/procedures/selecting";
  import { workspaceState } from "$model/client/workspace-state";

  let { elementId }: { elementId: string } = $props();

  const view = workspaceState();

  const threadRows = read({ path: "commentThreads" });

  const count = $derived.by(() => {
    const found = threadRows.current;
    if (found?.kind !== "table") return 0;
    return (found.rows as unknown as { within?: { kind: string; elementId?: string }; resolution?: unknown }[]).filter(
      (row) => row.within?.kind === "element" && row.within.elementId === elementId && row.resolution === undefined
    ).length;
  });

  const open = () => {
    const signal = threadsSignal(elementId);
    view.inspect(signal.key, signal.selection);
  };
</script>

<PanelButton
  label={count === 0 ? "Comment" : `${count} comment${count === 1 ? "" : "s"}`}
  icon={MessageSquare}
  title={count === 0 ? "Start a thread on this object" : "Open the threads on this object"}
  onclick={open}
/>
