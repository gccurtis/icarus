<script lang="ts">
  import { GitBranch, Plus } from '@lucide/svelte';
  import { Badge, Button, Input, Textarea, toast } from '$lib/components';
  import TaskList from './TaskList.svelte';
  import { agentTasks, tasksFor, type Personality } from './agents-mock';

  // The work surface for a personality: its DEFINITION — the behavioral contract
  // an agent runs under — over the task history it has produced. The definition
  // fields mirror Omega's PersonaDefinition one for one, and edits become a new
  // VERSION (personas.revise), never a silent rewrite: a task records which
  // version it ran as, so history stays attributable.
  let {
    personality,
    selectedTaskId,
    onselecttask,
    ondefinitionfocus
  }: {
    personality: Personality;
    selectedTaskId: string | null;
    onselecttask: (id: string) => void;
    /** Working on the definition means the personality is what you have selected,
     *  so the console releases any selected task — see the section below. */
    ondefinitionfocus?: () => void;
  } = $props();

  let history = $derived(tasksFor($agentTasks, personality.id));
</script>

<div class="flex min-h-0 flex-1 flex-col gap-4 px-8 pb-24">
  <!-- `onfocusin` releases the task selection: the work surface holds ONE
       selection, and putting the caret in the definition means you have selected
       the personality, not a task. Without it the panel would describe a task
       while you edited something else, and the bar would still be pointed at that
       task's agent. Focus rather than click, so keyboard arrival counts too. -->
  <section
    onfocusin={ondefinitionfocus}
    class="flex min-h-0 flex-1 flex-col overflow-hidden rounded-panel border border-border"
  >
    <div
      class="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-panel px-4 py-2"
    >
      <h2 class="flex items-center gap-2 text-body font-semibold">
        Definition
        <Badge tone="neutral" title="Definitions are versioned — a task records the version it ran as">
          <GitBranch class="size-3" /> v{personality.version}
        </Badge>
      </h2>
      <Button
        variant="ghost"
        size="sm"
        onclick={() => toast('Saving a revision is not wired up yet.', { tone: 'attention' })}
      >
        Save as new revision
      </Button>
    </div>
    <div class="quiet-scroll min-h-0 flex-1 space-y-3 overflow-y-auto bg-work p-4">
      <div>
        <label class="mb-1 block text-caption text-muted" for="per-focus">Focus</label>
        <Input id="per-focus" size="sm" value={personality.definition.focus ?? ''} />
        <p class="mt-1 text-caption text-muted">What this personality is for — its job, in one line.</p>
      </div>
      <div>
        <label class="mb-1 block text-caption text-muted" for="per-guidance">Behavioral guidance</label>
        <Textarea id="per-guidance" rows={3} value={personality.definition.behavioralGuidance ?? ''} />
        <p class="mt-1 text-caption text-muted">
          The rules it works under. This is the contract every task inherits.
        </p>
      </div>
      <div>
        <label class="mb-1 block text-caption text-muted" for="per-output">Output preferences</label>
        <Textarea id="per-output" rows={2} value={personality.definition.outputPreferences ?? ''} />
      </div>
      <div>
        <label class="mb-1 block text-caption text-muted" for="per-verify">Verification</label>
        <Input id="per-verify" size="sm" value={personality.definition.defaultVerification ?? ''} />
        <p class="mt-1 text-caption text-muted">What "done and trustworthy" means for its work.</p>
      </div>
    </div>
  </section>

  <!-- The receipts: what this personality has actually done, across projects.
       Mirrors Omega's real per-persona history (GET /personas/:id/tasks). -->
  <section class="flex shrink-0 flex-col overflow-hidden rounded-panel border border-border">
    <h2 class="shrink-0 border-b border-border bg-panel px-4 py-2.5 text-body font-semibold">
      Task history <span class="font-normal text-muted">({history.length})</span>
    </h2>
    <div class="quiet-scroll max-h-56 overflow-y-auto bg-work">
      {#if history.length}
        <TaskList tasks={history} selectedId={selectedTaskId} onselect={onselecttask} showPersonality={false} />
      {:else}
        <p class="px-4 py-3 text-caption text-muted">
          No tasks yet — assign it work from a project's dock.
        </p>
      {/if}
    </div>
  </section>
</div>

<style>
  .quiet-scroll {
    scrollbar-width: none;
  }
  .quiet-scroll::-webkit-scrollbar {
    display: none;
  }
</style>
