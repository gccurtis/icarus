<script lang="ts">
  import { Building2, MoreHorizontal, Star } from '@lucide/svelte';
  import { Badge, InspectorSection, KeyValue, Menu, toast } from '$lib/components';
  import LibraryShell from './LibraryShell.svelte';
  import AgentsRail from './AgentsRail.svelte';
  import ActivitySpace from './ActivitySpace.svelte';
  import PersonalitySpace from './PersonalitySpace.svelte';
  import TaskDetails from './TaskDetails.svelte';
  import LibraryDetails from './LibraryDetails.svelte';
  import LibraryPanel from './LibraryPanel.svelte';
  import LibraryQuarterback from './LibraryQuarterback.svelte';
  import { closeAssistant, resetAssistant, setDraftPersonality } from './library-assistant';
  import { OWNERS } from './library-mock';
  import { ACTIVE_STATES, PERSONALITIES, agentTasks, personalityById } from './agents-mock';

  /**
   * The Agents console: monitor the agents working for you across projects,
   * steer the ones that are running, and build the PERSONALITIES they run as.
   *
   * Personalities are sub-routes (`/library/agents/[id]`) because they are
   * durable, shareable assets — a link to one must work. Tasks are selection,
   * not routes: they are transient work, and their home is the detail panel.
   *
   * The selected task is the hinge of this whole screen. It decides what the
   * panel shows, what the second tab is called, and — because composer and panel
   * are one surface — where the bar sends: a selected task means you are talking
   * to an agent that exists, and no selection means the next send starts one.
   */
  let { personaId }: { personaId: string | null } = $props();

  let query = $state('');
  let owner = $state('all');
  let selectedTaskId = $state<string | null>(null);

  const matches = (name: string, description: string) =>
    `${name} ${description}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  const ownerOk = (id: string) => owner === 'all' || id === owner;

  let personalities = $derived(
    PERSONALITIES.filter((p) => ownerOk(p.ownerId) && matches(p.name, p.description))
  );

  // An unknown id (stale link, deleted personality) falls back to Activity
  // rather than erroring — the rail simply shows nothing selected.
  let personality = $derived(personaId ? (personalityById(personaId) ?? null) : null);
  let selectedTask = $derived($agentTasks.find((t) => t.id === selectedTaskId) ?? null);

  let running = $derived($agentTasks.filter((t) => ACTIVE_STATES.includes(t.state)).length);

  const ownerLabel = (id: string) => OWNERS.find((o) => o.id === id)?.label ?? id;
  const isOrg = (id: string) => OWNERS.find((o) => o.id === id)?.kind === 'org';

  // Switching between Activity and a personality drops the task selection —
  // the panel should never describe a task the center no longer shows — and
  // starts the assistant fresh, since the conversation was about the old view.
  $effect(() => {
    void personaId;
    selectedTaskId = null;
    resetAssistant();
  });

  // The bar's persona picker always names whoever the bar is addressing: the
  // agent running the selected task, or — with nothing selected — the personality
  // you have open, because if you opened Planner and reached for the bar you
  // meant Planner. Falls back to the default on the Activity view.
  $effect(() => {
    const id = selectedTask?.personalityId ?? personality?.id;
    if (id) setDraftPersonality(id);
  });

  // Selecting a task swaps the panel TO the task, even when the Agent lens is
  // open: clicking a task means "show me this one", and leaving the composer's
  // lens up would answer a different question. Clicking it again releases it.
  function selectTask(id: string) {
    selectedTaskId = selectedTaskId === id ? null : id;
    closeAssistant();
  }

  // Starting an agent from the bar puts it in front of you: the new task is
  // selected, which also flips the panel to its Task lens.
  function started(taskId: string | null) {
    if (taskId) selectedTaskId = taskId;
  }
</script>

<LibraryShell space="agents" title={personality ? personality.name : 'Agents'}>
  <AgentsRail {personalities} activeId={personality?.id ?? null} bind:query bind:owner />

  <main class="surface-work relative flex min-w-0 flex-1 flex-col overflow-hidden">
    <header class="flex shrink-0 items-start gap-4 px-8 pb-4 pt-5">
      <div class="min-w-0 flex-1">
        {#if personality}
          <div class="flex items-center gap-2">
            <h1 class="truncate text-h3 font-semibold">{personality.name}</h1>
            {#if personality.isDefault}
              <Badge tone="attention"><Star class="size-3 fill-current" /> Default</Badge>
            {/if}
          </div>
          <p class="mt-1 flex items-center gap-1.5 text-caption text-muted">
            Owner:
            <span class="text-secondary">{ownerLabel(personality.ownerId)}</span>
            {#if isOrg(personality.ownerId)}<Building2 class="size-3" />{/if}
          </p>
        {:else}
          <h1 class="truncate text-h3 font-semibold">Activity</h1>
          <p class="mt-1 text-caption text-muted">
            Every agent working for you, across projects.
          </p>
        {/if}
      </div>
      {#if personality}
        <div class="-mr-3 -mt-1.5 flex shrink-0 flex-col items-end gap-2">
          <Menu
            align="end"
            label="More"
            items={[
              { label: 'Share' },
              { label: 'Duplicate' },
              {
                label: 'Make default',
                onselect: () => toast('Setting the default is not wired up yet.', { tone: 'attention' })
              },
              { divider: true },
              { label: 'Delete', danger: true }
            ]}
          >
            {#snippet trigger()}<MoreHorizontal class="size-4" />{/snippet}
          </Menu>
        </div>
      {/if}
    </header>

    {#if personality}
      <PersonalitySpace
        {personality}
        {selectedTaskId}
        onselecttask={selectTask}
        ondefinitionfocus={() => (selectedTaskId = null)}
      />
    {:else}
      <ActivitySpace tasks={$agentTasks} selectedId={selectedTaskId} onselect={selectTask} />
    {/if}

    <!-- One bar, two destinations, decided by the selection: it continues the
         selected task's exchange, or — with nothing selected — starts a new agent
         whose objective is its text, whose personality is its persona picker, and
         whose project and extra context come from the Agent lens. -->
    <LibraryQuarterback
      space="agents"
      assetName="a new agent"
      task={selectedTask}
      onstarted={started}
    />
  </main>

  <!-- The panel follows what you are looking AT: a selected task always wins
       (that is where steering lives); otherwise the personality's identity; on
       plain Activity, the numbers that answer "do I need to look?".
       The second tab names its destination — "Agent" continues the selected
       task, "New agent" starts one — because that is the one thing neither the
       composer nor its text can tell you. -->
  <LibraryPanel
    space="agents"
    detailsLabel={selectedTask ? 'Task' : personality ? 'Details' : 'Now'}
    agentLabel={selectedTask ? 'Agent' : 'New agent'}
    assetLabel={personality?.name ?? null}
    task={selectedTask}
  >
    {#snippet details()}
      {#if selectedTask}
        <TaskDetails task={selectedTask} />
      {:else if personality}
        <LibraryDetails
          asset={personality}
          descriptionHint="Shown wherever a personality is picked."
          copiesNote="Editing this personality does not change the copy in {personality.origin
            .project}."
        />
      {:else}
        <InspectorSection title="Now">
          <KeyValue
            rows={[
              { key: 'Working', value: String(running) },
              { key: 'Finished', value: String($agentTasks.length - running) },
              { key: 'Personalities', value: String(PERSONALITIES.length) }
            ]}
          />
          <p class="mt-3 border-t border-border pt-2.5 text-caption text-muted">
            Select a task to read its exchange and steer it.
          </p>
        </InspectorSection>
      {/if}
    {/snippet}
  </LibraryPanel>
</LibraryShell>
