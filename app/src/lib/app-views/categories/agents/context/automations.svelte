<script lang="ts">
  import { onDestroy, onMount } from "svelte";
  import Play from "@lucide/svelte/icons/play";
  import Plus from "@lucide/svelte/icons/plus";
  import Workflow from "@lucide/svelte/icons/workflow";

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
  import {
    agentsLibrary,
    inspectAutomation,
    inspectTask,
    isSelected,
    makeAutomation,
    messageOf,
    openAutomation,
    runAutomation
  } from "$app-views/categories/agents/procedures/library.svelte";
  import { relativeTime } from "$app-views/categories/agents/procedures/time";
  import { triggerSummary } from "$app-views/categories/agents/procedures/vocabulary";
  import type { AutomationItem } from "$capabilities/agents/index.remote";
  import { workspaceState } from "$model/client/workspace-state";

  const view = workspaceState();
  const library = agentsLibrary();

  let live = true;
  onDestroy(() => {
    live = false;
  });

  let pending = $state<string>();
  let actionError = $state<string>();

  const make = async () => {
    if (pending !== undefined || !library.ready) return;
    const personaId = library.current.personas[0]?.id;
    if (personaId === undefined) {
      actionError = "Make a persona first; an automation asks one to work.";
      return;
    }
    pending = "new";
    actionError = undefined;
    try {
      const id = await makeAutomation(
        view,
        personaId,
        library.current.automations.map((row) => row.name)
      );
      if (live && id !== undefined) openAutomation(view, id);
    } catch (error) {
      if (live) actionError = messageOf(error);
    } finally {
      pending = undefined;
    }
  };

  const run = async (row: AutomationItem) => {
    if (pending !== undefined) return;
    pending = row.id;
    actionError = undefined;
    try {
      const result = await runAutomation(view, row.id);
      if (!live) return;
      if (result.accepted) inspectTask(view, result.taskId);
      else actionError = result.detail;
    } catch (error) {
      if (live) actionError = messageOf(error);
    } finally {
      pending = undefined;
    }
  };

  let now = $state(Date.now());
  onMount(() => {
    const timer = setInterval(() => (now = Date.now()), 30_000);
    return () => clearInterval(timer);
  });

  const all = $derived(library.ready ? library.current.automations : []);

  let query = $state("");
  const needle = $derived(query.trim().toLocaleLowerCase());
  const shown = $derived(
    all.filter(
      (row) =>
        needle === "" ||
        row.name.toLocaleLowerCase().includes(needle) ||
        row.personaName.toLocaleLowerCase().includes(needle)
    )
  );
  const manual = $derived(shown.filter((row) => row.trigger.kind === "manual"));
  const standing = $derived(shown.filter((row) => row.trigger.kind !== "manual"));
  const on = $derived(standing.filter((row) => row.enabled));
  const off = $derived(standing.filter((row) => !row.enabled));

  const sub = (row: AutomationItem): string =>
    `${row.personaName} · ${triggerSummary(row.trigger, row.triggerRefName ?? undefined)}`;

  const meta = (row: AutomationItem): string | undefined =>
    row.lastFiredAt === null ? undefined : relativeTime(row.lastFiredAt, now);
</script>

{#snippet list(entries: readonly AutomationItem[])}
  {#each entries as row (row.id)}
    <div role="presentation" ondblclick={() => openAutomation(view, row.id)}>
      <PanelRow
        title={row.name}
        sub={sub(row)}
        meta={meta(row)}
        icon={Workflow}
        tone={row.running > 0 ? "active" : "default"}
        selected={isSelected(view, "automation", row.id)}
        onselect={() => inspectAutomation(view, row.id)}
      />
    </div>
  {/each}
{/snippet}

{#snippet runnable(entries: readonly AutomationItem[])}
  {#each entries as row (row.id)}
    <div role="presentation" ondblclick={() => openAutomation(view, row.id)}>
      <PanelRow
        title={row.name}
        sub={sub(row)}
        icon={Workflow}
        tone={row.running > 0 ? "active" : "default"}
        selected={isSelected(view, "automation", row.id)}
        onselect={() => inspectAutomation(view, row.id)}
      >
        {#snippet control()}
          <PanelButton
            label={pending === row.id ? "Starting" : "Run"}
            icon={Play}
            tone="ghost"
            disabled={pending !== undefined}
            title="Start one task from this now"
            onclick={() => run(row)}
          />
        {/snippet}
      </PanelRow>
    </div>
  {/each}
{/snippet}

<Panel title="Automations">
  {#snippet actions()}
    <PanelButton label="New" icon={Plus} tone="primary" disabled={pending !== undefined} onclick={make} />
  {/snippet}

  {#if actionError}
    <PanelBanner title="That did not happen" tone="attention">{actionError}</PanelBanner>
  {/if}

  {#if library.error}
    <PanelBanner title="Automations unavailable" tone="danger">{messageOf(library.error)}</PanelBanner>
    <div class="px-3 pt-2">
      <Button variant="outline" size="sm" onclick={() => library.refresh()}>Retry</Button>
    </div>
  {:else if !library.ready}
    <PanelSkeleton shape="rows" count={5} />
  {:else}
    <PanelSearch
      placeholder="Search automations"
      matched={shown.length === 0 ? 0 : undefined}
      flush
      empty="No automation is named that way."
      bind:value={query}
    >
      <PanelSection title="Manual" count={manual.length} flush>
        {@render runnable(manual)}
      </PanelSection>
      <PanelSection title="On" count={on.length} flush>
        {@render list(on)}
      </PanelSection>
      <PanelSection title="Off" count={off.length} flush open={on.length === 0}>
        {@render list(off)}
      </PanelSection>
    </PanelSearch>
  {/if}
</Panel>
