<script lang="ts">
  import MessageSquare from "@lucide/svelte/icons/message-square";

  import { PanelButton } from "$authored-components/panel";
  import { commentsQuery, threadsIn } from "$app-views/categories/presentation-editor/procedures/comments";
  import { threadsSignal } from "$app-views/categories/presentation-editor/procedures/selecting";
  import { workspaceState } from "$model/client/workspace-state";

  let { elementId }: { elementId: string } = $props();

  const view = workspaceState();

  const comments = commentsQuery();

  const count = $derived(
    threadsIn(comments).filter(
      (row) => row.within?.kind === "element" && row.within.elementId === elementId && row.resolution === undefined
    ).length
  );

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
