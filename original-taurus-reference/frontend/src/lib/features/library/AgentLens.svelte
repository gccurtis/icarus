<script lang="ts">
  import { CornerDownLeft, Layers, Plus, Search, Sparkles, X } from '@lucide/svelte';
  import { Button, Chip, Input, MockBadge, Modal, Select, StatePill } from '$lib/components';
  import { aiModeOptions } from '$data/ai-agent';
  import { iconTileClass } from '$data/projects';
  import { CONTEXTS, formatCount } from './library-mock';
  import TaskExchange from './TaskExchange.svelte';
  import { TASK_PILL, personalityById, type AgentTask } from './agents-mock';
  import {
    addDraftContext,
    assistant,
    cuesFor,
    projectOptions,
    removeDraftContext,
    setDraftProject,
    type LibrarySpace
  } from './library-assistant';

  /**
   * The right-hand panel's second lens, on every library space. Mode, persona and
   * web live in the bar — one control each, never two — so this holds the parts
   * the bar cannot express.
   *
   * It has TWO shapes, because the bar has two destinations:
   *
   * - **A task is selected** → you are talking to an agent that already exists.
   *   The lens is its exchange, and the send continues it. Where it runs and what
   *   it reads were settled when it was born and are not up for negotiation, so
   *   there is no Project picker here.
   * - **Nothing is selected** → the send starts a new agent, and the lens is the
   *   part of that request the bar cannot hold: where it runs, what it reads.
   *
   * Context and Templates only ever have the second shape.
   */
  let {
    space,
    assetLabel,
    task = null
  }: {
    space: LibrarySpace;
    /** The thing on screen, always in scope and never removable. */
    assetLabel: string | null;
    /** Agents only: the task the bar is addressing, if one is selected. */
    task?: AgentTask | null;
  } = $props();

  let pickerOpen = $state(false);
  let query = $state('');

  const modeLabel = $derived(
    aiModeOptions.find((o) => o.value === $assistant.mode)?.label ?? 'Ask'
  );
  /** Who the bar is addressing — drives the cue and the bar's placeholder. */
  const target = $derived(
    task ? (personalityById(task.personalityId)?.name ?? 'this agent') : null
  );
  const added = $derived(
    $assistant.draft.contexts
      .map((id) => CONTEXTS.find((c) => c.id === id))
      .filter((c) => c !== undefined)
  );
  const choices = $derived(
    CONTEXTS.filter(
      (c) =>
        !$assistant.draft.contexts.includes(c.id) &&
        `${c.name} ${c.description}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
    )
  );
</script>

<div class="space-y-3">
  <div class="space-y-2 border-b border-border pb-3">
    <div class="flex items-center gap-2">
      <Sparkles class="size-4 text-intel" />
      <p class="text-body-sm font-medium text-primary">{modeLabel}</p>
      <MockBadge class="ml-auto px-1.5 py-0" />
    </div>
    <p class="text-caption text-muted">{cuesFor(space, target)[$assistant.mode]}</p>
  </div>

  {#if task}
    <!-- Talking to an agent that exists. Enough to know WHICH agent — the Task
         lens next door carries the full record, so this is identification, not a
         second copy of it. -->
    <div class="rounded-control border border-border bg-work px-2.5 py-2">
      <div class="flex items-center gap-2">
        <StatePill state={TASK_PILL[task.state].state} label={TASK_PILL[task.state].label} />
        <span class="min-w-0 truncate text-caption text-muted">{target} · {task.project}</span>
      </div>
      <p class="mt-1.5 text-body-sm text-primary">{task.objective}</p>
    </div>

    <div>
      <p class="mb-1 text-caption text-muted">Exchange</p>
      <!-- Roomier than the Task lens's copy: here the conversation IS the lens. -->
      <TaskExchange transcript={task.transcript} max="max-h-72" />
    </div>

    <p
      class="flex items-start gap-2 rounded-control border border-intel/40 bg-intel/5 px-2.5 py-2 text-caption text-secondary"
    >
      <CornerDownLeft class="mt-0.5 size-3.5 shrink-0 text-intel" />
      The bar continues this exchange instead of starting a new agent. Your line is recorded and
      not delivered — messaging a running task has no endpoint yet.
    </p>
  {:else}
    <!-- Where it runs. "None" is the per-user scope Omega will back with an
         internal, unshareable project — library work always has somewhere to go,
         and an agent never moves between projects, so this is chosen up front. -->
    <div>
      <label class="mb-1 block text-caption text-muted" for="agent-project">Project</label>
      <Select
        id="agent-project"
        size="sm"
        value={$assistant.draft.project}
        onchange={(e: Event) => setDraftProject((e.currentTarget as HTMLSelectElement).value)}
        options={projectOptions}
      />
    </div>

    <!-- What it reads. The thing on screen is always in scope; everything else is
         added deliberately, from the whole library. -->
    <div>
      <p class="mb-1 text-caption text-muted">Context</p>
      <div class="flex flex-wrap gap-1.5">
        {#if assetLabel}
          <Chip tone="intel"><Layers class="size-3" /> {assetLabel}</Chip>
        {/if}
        {#each added as c (c.id)}
          <Chip onremove={() => removeDraftContext(c.id)}>{c.name}</Chip>
        {/each}
        <Button variant="ghost" size="sm" onclick={() => (pickerOpen = true)}>
          <Plus class="size-3.5" /> Add context
        </Button>
      </div>
      {#if assetLabel}
        <p class="mt-1.5 text-caption text-muted">
          What you are looking at is always in scope.
        </p>
      {/if}
    </div>

    {#if space === 'agents'}
      <p
        class="flex items-start gap-2 rounded-control border border-intel/40 bg-intel/5 px-2.5 py-2 text-caption text-secondary"
      >
        <CornerDownLeft class="mt-0.5 size-3.5 shrink-0 text-intel" />
        The bar starts a new agent: its text is the objective, and its persona picker is the
        personality it runs as. Select a task instead to talk to one that already exists.
      </p>
    {:else if $assistant.turns.length}
      <div class="space-y-2.5">
        {#each $assistant.turns as turn (turn.id)}
          <div
            class="rounded-control border px-2.5 py-2 {turn.author === 'you'
              ? 'border-border bg-work'
              : 'border-intel/40 bg-intel/5'}"
          >
            <p
              class="text-caption font-medium {turn.author === 'you'
                ? 'text-action'
                : 'text-intel'}"
            >
              {turn.author === 'you' ? 'You' : 'Agent'}
            </p>
            <p class="mt-0.5 text-caption text-secondary">{turn.body}</p>
          </div>
        {/each}
      </div>
    {:else}
      <p
        class="rounded-control border border-dashed border-border px-3 py-4 text-caption text-muted"
      >
        Describe what you want done — drafting a template, filling out a context — and the bar
        sends it as a whole request.
      </p>
    {/if}
  {/if}
</div>

<!-- A modal, not a checkbox grid: you are picking from the whole context
     library, which does not fit beside the request it feeds. -->
<Modal bind:open={pickerOpen} title="Add context" size="sm">
  <div class="space-y-3">
    <div class="relative">
      <Search
        class="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted"
      />
      <Input
        bind:value={query}
        size="sm"
        placeholder="Search contexts"
        aria-label="Search contexts"
        class="pl-8"
      />
    </div>
    <div class="quiet-scroll max-h-72 overflow-y-auto rounded-control border border-border p-1.5">
      {#each choices as c (c.id)}
        <button
          class="dur-micro flex w-full items-center gap-2 rounded-control px-1.5 py-1.5 text-left transition-colors hover:bg-elevated"
          onclick={() => {
            addDraftContext(c.id);
            pickerOpen = false;
            query = '';
          }}
        >
          <span
            class="flex size-6 shrink-0 items-center justify-center rounded-control {iconTileClass(
              'intel'
            )}"
          >
            <Layers class="size-3.5" />
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate text-body-sm text-secondary">{c.name}</span>
            <span class="block truncate text-caption text-muted">{c.description}</span>
          </span>
          <span class="shrink-0 text-caption text-muted">{formatCount(c.resolved.length)}</span>
        </button>
      {:else}
        <p class="px-1.5 py-2 text-caption text-muted">Nothing left to add.</p>
      {/each}
    </div>
  </div>
  {#snippet footer()}
    <Button variant="ghost" onclick={() => (pickerOpen = false)}>
      <X class="size-3.5" /> Close
    </Button>
  {/snippet}
</Modal>

<style>
  .quiet-scroll {
    scrollbar-width: none;
  }
  .quiet-scroll::-webkit-scrollbar {
    display: none;
  }
</style>
