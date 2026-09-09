<script lang="ts">
  import Plus from "@lucide/svelte/icons/plus";
  import Sparkles from "@lucide/svelte/icons/sparkles";

  import {
    Panel,
    PanelBanner,
    PanelButton,
    PanelRow,
    PanelSearch,
    PanelSection,
    PanelSkeleton
  } from "$authored-components/panel";
  import { Button } from "$vendored-components/button";
  import { agentsLibrary, messageOf } from "$app-views/categories/agents/procedures/agents";
  import { startClock } from "$app-views/categories/agents/procedures/effects/clock.svelte";
  import { inspectAgent } from "$app-views/categories/agents/procedures/inspect";
  import {
    isSelected,
    openNewTask,
    openTask
  } from "$app-views/categories/agents/procedures/navigate";
  import { taskRowsIn, type TaskRow } from "$app-views/categories/agents/procedures/tasks";
  import { workspaceState } from "$model/client/workspace-state";

  const view = workspaceState();
  const library = agentsLibrary();

  const clock = startClock();

  const rows = $derived(taskRowsIn(library.ready ? library.current : undefined, clock.now));

  let query = $state("");
  const needle = $derived(query.trim().toLocaleLowerCase());
  const shown = $derived(
    rows.filter(
      (row) =>
        needle === "" ||
        row.title.toLocaleLowerCase().includes(needle) ||
        row.personaName.toLocaleLowerCase().includes(needle)
    )
  );
  const running = $derived(shown.filter((row) => row.state === "running"));
  const review = $derived(shown.filter((row) => row.state === "review"));
  const finished = $derived(shown.filter((row) => row.state === "finished"));

  const sub = (row: TaskRow): string => {
    const parts = [row.personaName, row.started];
    if (row.openQuestions > 0) parts.push(`${row.openQuestions} to answer`);
    return parts.join(" · ");
  };
</script>

{#snippet list(entries: readonly TaskRow[], tone: "default" | "active" | "intelligence")}
  {#each entries as row (row.id)}
    <div role="presentation" ondblclick={() => openTask(view, row.id)}>
      <PanelRow
        title={row.title}
        sub={sub(row)}
        icon={Sparkles}
        {tone}
        titleTone={row.openQuestions > 0 ? "attention" : undefined}
        selected={isSelected(view, "task", row.id)}
        onselect={() => inspectAgent(view, { kind: "task", id: row.id })}
      />
    </div>
  {/each}
{/snippet}

<Panel title="Tasks">
  {#snippet actions()}
    <PanelButton label="New task" icon={Plus} tone="primary" onclick={() => openNewTask(view)} />
  {/snippet}

  {#if library.error}
    <PanelBanner title="Tasks unavailable" tone="danger">{messageOf(library.error)}</PanelBanner>
    <div class="px-3 pt-2">
      <Button variant="outline" size="sm" onclick={() => library.refresh()}>Retry</Button>
    </div>
  {:else if !library.ready}
    <PanelSkeleton shape="rows" count={6} />
  {:else}
    <PanelSearch
      placeholder="Search tasks"
      matched={shown.length === 0 ? 0 : undefined}
      flush
      empty="No task is named that way."
      bind:value={query}
    >
      <PanelSection title="Running" count={running.length} flush>
        {@render list(running, "active")}
      </PanelSection>
      <PanelSection title="Pending review" count={review.length} flush>
        {@render list(review, "intelligence")}
      </PanelSection>
      <PanelSection title="Finished" count={finished.length} flush open={running.length + review.length === 0}>
        {@render list(finished, "default")}
      </PanelSection>
    </PanelSearch>
  {/if}
</Panel>
