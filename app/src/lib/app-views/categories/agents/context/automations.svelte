<script lang="ts">
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
  import { agentsLibrary, messageOf } from "$app-views/categories/agents/procedures/agents";
  import { startClock } from "$app-views/categories/agents/procedures/effects/clock.svelte";
  import { releaseWhenGone } from "$app-views/categories/agents/procedures/effects/release.svelte";
  import { inspectAgent } from "$app-views/categories/agents/procedures/inspect";
  import { makeAutomation } from "$app-views/categories/agents/procedures/make-automation";
  import { isSelected, openAutomation } from "$app-views/categories/agents/procedures/navigate";
  import { run, type Working } from "$app-views/categories/agents/procedures/run";
  import { runAutomation } from "$app-views/categories/agents/procedures/run-automation";
  import { relativeTime } from "$app-views/categories/agents/procedures/time";
  import { triggerSummary } from "$app-views/categories/agents/procedures/vocabulary";
  import type { AutomationItem } from "$capabilities/agents/index.remote";
  import { workspaceState } from "$model/client/workspace-state";

  const view = workspaceState();
  const library = agentsLibrary();

  const surface: Working = $state({ mounted: true, busy: undefined, failure: undefined });
  releaseWhenGone(surface);

  const make = () => {
    if (!library.ready) return;
    const personaId = library.current.personas[0]?.id;
    if (personaId === undefined) {
      surface.failure = "Make a persona first; an automation asks one to work.";
      return;
    }
    const taken = library.current.automations.map((row) => row.name);
    void run(
      surface,
      "new",
      () => makeAutomation(view, personaId, taken),
      (made) => openAutomation(view, made.id)
    );
  };

  const fire = (row: AutomationItem) => {
    void run(
      surface,
      row.id,
      () => runAutomation(view, row.id),
      (fired) => inspectAgent(view, { kind: "task", id: fired.taskId })
    );
  };

  const clock = startClock();

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
    row.lastFiredAt === null ? undefined : relativeTime(row.lastFiredAt, clock.now);
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
        onselect={() => inspectAgent(view, { kind: "automation", id: row.id })}
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
        onselect={() => inspectAgent(view, { kind: "automation", id: row.id })}
      >
        {#snippet control()}
          <PanelButton
            label={surface.busy === row.id ? "Starting" : "Run"}
            icon={Play}
            tone="ghost"
            disabled={surface.busy !== undefined}
            title="Start one task from this now"
            onclick={() => fire(row)}
          />
        {/snippet}
      </PanelRow>
    </div>
  {/each}
{/snippet}

<Panel title="Automations">
  {#snippet actions()}
    <PanelButton
      label="New"
      icon={Plus}
      tone="primary"
      disabled={surface.busy !== undefined}
      onclick={make}
    />
  {/snippet}

  {#if surface.failure}
    <PanelBanner title="That did not happen" tone="attention">{surface.failure}</PanelBanner>
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
