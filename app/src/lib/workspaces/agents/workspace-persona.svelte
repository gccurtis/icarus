<script lang="ts">
  import Boxes from "@lucide/svelte/icons/boxes";
  import Wrench from "@lucide/svelte/icons/wrench";

  import { PanelActor, PanelChip } from "$lib/unique-components/panel";
  import {
    ScreenBar,
    ScreenCell,
    ScreenEmpty,
    ScreenGroup,
    ScreenItem,
    ScreenList,
    ScreenRow,
    ScreenStat,
    ScreenStats,
    ScreenSurface,
    ScreenTable
  } from "$lib/unique-components/screen";
  import {
    behaviourOf,
    lookupScopeOf,
    persona as personaDoor,
    tasksIn,
    toolsFor,
    type BehaviourSection,
    type TaskRow,
    type ToolPermission
  } from "$mock-capabilities/agents";
  import { viewState } from "$model/client/view-state";

  const view = viewState();

  /**
   * One persona: what it is, how it is defined, and what it is doing.
   *
   * `focus` names it. Reached by opening a card in the library rather than by a
   * switch in the shell — choosing which persona and choosing to edit one are the
   * same act, so they are one call, and the way back is the bar at the top.
   *
   * **Three bands, in the order the questions come.** Who is this and how is it
   * doing; then how it is defined; then, at the bottom, the work itself — because
   * the work is the band you scroll to and the definition is the band you edit.
   *
   * **Nothing here is the lens.** Every row opens an inspector rather than
   * expanding in place: a behaviour section is 400 characters of prose and a tool
   * permission is a decision, and neither fits between two other bands.
   */
  const id = $derived(view.active.focus ?? "grid-analyst");

  const profile = $derived(personaDoor(id).current);
  const behaviour = $derived(behaviourOf(id).current);
  const scope = $derived(lookupScopeOf(id).current);
  const tools = $derived(toolsFor(id).current);
  const tasks = $derived(
    tasksIn(view.project).current.filter((row: TaskRow) => row.persona === profile.id)
  );

  const written = $derived(
    behaviour.filter((entry: BehaviourSection) => entry.text.trim() !== "")
  );

  const granted = $derived(tools.filter((tool: ToolPermission) => tool.allowed));

  const STATE_TONE: Record<TaskRow["state"], "neutral" | "success" | "danger" | "attention"> = {
    running: "attention",
    waiting: "neutral",
    completed: "success",
    failed: "danger"
  };

  /** How long it has been going, from the sortable minutes rather than the phrase. */
  const elapsed = (minutes: number): string =>
    minutes < 60
      ? `${minutes} min`
      : minutes < 1_440
        ? `${Math.round(minutes / 60)} h`
        : `${Math.round(minutes / 1_440)} d`;
</script>

<ScreenSurface wide>
  <div class="board">
    <div class="area-bar">
      <ScreenBar
        title={profile.name}
        backLabel="All agents"
        onback={() => view.showSubscreen("library")}
      >
        {#snippet meta()}
          <PanelChip tone="neutral">{profile.scope}</PanelChip>
          <PanelChip>Revision {profile.revision}</PanelChip>
        {/snippet}
      </ScreenBar>
    </div>

    <!--
      Identity and record together: two personas with similar prose are told apart
      by what they have done, so the counts sit beside the description rather than
      behind a tab.
    -->
    <div class="area-overview flex flex-col gap-3">
      <div class="flex items-start gap-3">
        <PanelActor name={profile.name} kind="agent" size="face" />
        <div class="flex min-w-0 flex-col gap-1">
          <p class="text-body-sm text-ink-primary m-0">{profile.describes}</p>
          <p class="text-caption text-ink-muted m-0">
            Built by {profile.createdBy} · changed {profile.updated}
          </p>
        </div>
      </div>

      <ScreenStats label="What it has done">
        <ScreenStat value={String(profile.record.running)} label="Running" tone="attention" />
        <ScreenStat value={String(profile.record.completed)} label="Completed" />
        <ScreenStat value={String(profile.record.failed)} label="Failed" tone="danger" />
        <ScreenStat value={String(profile.record.findings)} label="Findings" />
        <ScreenStat value={String(profile.record.conversations)} label="Conversations" />
      </ScreenStats>
    </div>

    <div class="area-behaviour min-w-0">
      <ScreenGroup label="Behaviour" count="{written.length} of {behaviour.length} written">
        <ScreenList label="Behaviour sections">
          {#each behaviour as section (section.id)}
            <ScreenItem
              title={section.name}
              excerpt={section.text.trim() === "" ? section.purpose : section.text}
              meta={section.text.trim() === "" ? "empty" : `${section.characters} chars`}
              selected={view.selection?.id === section.id}
              onselect={() =>
                view.inspect("agents.behaviour-section", {
                  kind: "behaviour",
                  id: section.id
                })}
            />
          {/each}
        </ScreenList>
      </ScreenGroup>
    </div>

    <div class="area-access flex min-w-0 flex-col gap-4">
      <!--
        What it can look up and what it may do are two different grants, and
        confusing them is how an agent ends up able to write where it was only
        meant to read.
      -->
      <ScreenGroup label="Can look up" tone="intelligence">
        <ScreenList label="Lookup scope">
          <ScreenItem
            title={scope.name}
            excerpt="{scope.searchable} of {scope.contains} searchable · {scope.sample.join(', ')}"
            meta={scope.travels ? "travels" : "this project"}
            onselect={() =>
              view.inspect("agents.what-it-can-look-up", { kind: "scope", id: scope.id })}
          >
            {#snippet lead()}<Boxes size={16} aria-hidden="true" />{/snippet}
          </ScreenItem>
        </ScreenList>
      </ScreenGroup>

      <ScreenGroup label="Tools" count="{granted.length} of {tools.length} allowed">
        <ScreenList label="Tool permissions">
          {#each tools as tool (tool.id)}
            <ScreenItem
              title={tool.does}
              meta={tool.allowed ? "allowed" : "off"}
              selected={view.selection?.id === tool.id}
              onselect={() => view.inspect("agents.tool", { kind: "tool", id: tool.id })}
            >
              {#snippet lead()}<Wrench size={16} aria-hidden="true" />{/snippet}
            </ScreenItem>
          {/each}
        </ScreenList>
      </ScreenGroup>
    </div>

    <div class="area-tasks min-w-0">
      <ScreenGroup label="Tasks it is managing" count={String(tasks.length)}>
        {#if tasks.length === 0}
          <ScreenEmpty title="Nothing running">
            Work handed to this persona will appear here while it runs and after it finishes.
          </ScreenEmpty>
        {:else}
          <ScreenTable columns={["Task", "Started by", "Running for", "Results", "State"]}>
            {#each tasks as row (row.id)}
              <ScreenRow>
                <ScreenCell
                  name={row.title}
                  onselect={() => view.showSubscreen("task", row.id)}
                />
                <ScreenCell>{row.firedBy ? `${row.startedBy} · Automation` : row.startedBy}</ScreenCell>
                <ScreenCell num>{elapsed(row.age)}</ScreenCell>
                <ScreenCell num>{row.results}</ScreenCell>
                <ScreenCell>
                  <PanelChip tone={STATE_TONE[row.state]}>{row.state}</PanelChip>
                </ScreenCell>
              </ScreenRow>
            {/each}
          </ScreenTable>
        {/if}
      </ScreenGroup>
    </div>
  </div>
</ScreenSurface>

<style>
  /**
   * Two tracks for the definition band and one for everything else. Behaviour is
   * prose and wants the measure; access is a short list of grants and does not.
   */
  .board {
    display: grid;
    gap: calc(var(--token-spacing-unit) * 5);
    grid-template-columns: 3fr 2fr;
    grid-template-areas:
      "bar       bar"
      "overview  overview"
      "behaviour access"
      "tasks     tasks";
    align-content: start;
  }

  .area-bar {
    grid-area: bar;
  }
  .area-overview {
    grid-area: overview;
  }
  .area-behaviour {
    grid-area: behaviour;
  }
  .area-access {
    grid-area: access;
  }
  .area-tasks {
    grid-area: tasks;
  }

  @media (max-width: 64rem) {
    .board {
      grid-template-columns: 1fr;
      grid-template-areas:
        "bar"
        "overview"
        "behaviour"
        "access"
        "tasks";
    }
  }
</style>
