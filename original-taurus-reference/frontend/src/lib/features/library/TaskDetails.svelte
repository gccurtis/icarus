<script lang="ts">
  import { Check, CircleSlash } from '@lucide/svelte';
  import { Alert, Button, InspectorSection, KeyValue, StatePill, toast } from '$lib/components';
  import TaskExchange from './TaskExchange.svelte';
  import { TASK_PILL, personalityById, type AgentTask } from './agents-mock';
  import type { AiTodoState } from '$systems/ai-agent/types';

  // The detail panel while a task is selected: what it is doing, its working
  // list, and the steering seam — read the exchange, tell it what to do next.
  // Steering is the one action here with NO backend: Omega tasks are
  // create/get/list/accept-plan only, so the bar records and says so.
  let { task }: { task: AgentTask } = $props();

  const TODO_TONE: Record<AiTodoState, string> = {
    open: 'text-muted',
    doing: 'text-focus',
    done: 'text-success',
    blocked: 'text-attention',
    canceled: 'text-muted line-through'
  };

  const active = $derived(task.state === 'queued' || task.state === 'running' || task.state === 'waiting');

</script>

<!-- Content only: the aside and its scroll belong to LibraryPanel. -->
<div>
  <InspectorSection title="Task">
    <div class="space-y-2.5">
      <div class="flex items-center gap-2">
        <StatePill state={TASK_PILL[task.state].state} label={TASK_PILL[task.state].label} />
        <span class="text-caption uppercase tracking-wide text-muted">{task.mode}</span>
      </div>
      <p class="text-body-sm text-primary">{task.objective}</p>
      {#if task.failure}
        <Alert tone="danger">{task.failure}</Alert>
      {/if}
      <KeyValue
        rows={[
          { key: 'Project', value: task.project },
          { key: 'Personality', value: personalityById(task.personalityId)?.name ?? '—' },
          { key: 'Started', value: task.started },
          { key: 'Updated', value: task.updated }
        ]}
      />
    </div>
  </InspectorSection>

  <!-- A just-started task has no working list yet; an empty section reads as a
       loading failure rather than "it has not planned anything". -->
  {#if task.todos.length}
    <InspectorSection title="Working list">
    <ul class="space-y-1.5">
      {#each task.todos as todo (todo.id)}
        <li class="flex items-start gap-2">
          {#if todo.state === 'done'}
            <Check class="mt-0.5 size-3.5 shrink-0 text-success" />
          {:else if todo.state === 'canceled'}
            <CircleSlash class="mt-0.5 size-3.5 shrink-0 text-muted" />
          {:else}
            <span
              class="mt-1 size-2 shrink-0 rounded-full {todo.state === 'doing'
                ? 'bg-focus'
                : todo.state === 'blocked'
                  ? 'bg-attention'
                  : 'bg-border-strong'}"
            ></span>
          {/if}
          <span class="min-w-0">
            <span class="block text-caption {TODO_TONE[todo.state]}">{todo.text}</span>
            {#if todo.detail}<span class="block text-caption text-muted">{todo.detail}</span>{/if}
          </span>
          </li>
        {/each}
      </ul>
    </InspectorSection>
  {/if}

  <!-- Read-only: the composer at the foot of the work surface is the ONE place
       you type at an agent. A Send button here would be a second path to the
       same act, on a screen that already has the bar. The Agent lens next door
       shows this same exchange, through the same TaskExchange, because it is the
       same conversation seen from the composer's side. -->
  <InspectorSection title="Exchange">
    <div class="space-y-2.5">
      <TaskExchange transcript={task.transcript} />
      {#if active}
        <p class="text-caption text-muted">
          Use the bar below to tell it what to do next.
        </p>
        {#if task.state === 'waiting'}
          <Button
            variant="secondary"
            size="sm"
            class="w-full"
            onclick={() =>
              toast('Plan review opens in the project’s dock — not wired from here yet.', {
                tone: 'attention'
              })}
          >
            Review plan
          </Button>
        {/if}
      {:else}
        <p class="text-caption text-muted">This task has finished — nothing left to steer.</p>
      {/if}
    </div>
  </InspectorSection>
</div>
