<script lang="ts">
  import { CircleCheck, ListChecks, Workflow } from '@lucide/svelte';
  import { Badge, Button } from '$lib/components';
  import { acceptAiPlan, aiAgent } from '$data/ai-agent';
  import { taskLabels, taskTones, todoMarks } from './helpers';

  // The spawned task (state + working list + failure) and, for Plan mode, the
  // reviewable draft with a real Accept action. Renders nothing without a task.
</script>

{#if $aiAgent.activeTask}
  {@const task = $aiAgent.activeTask}
  <div class="rounded-control border border-border">
    <div class="flex items-center gap-2 px-2.5 py-2">
      <Workflow class="size-4 shrink-0 text-focus" />
      <span class="min-w-0 flex-1">
        <span class="block text-caption font-medium text-focus">
          Task · {task.mode === 'plan' ? 'Plan' : 'Action'}
        </span>
        <span class="block truncate text-label text-secondary">{task.objective}</span>
      </span>
      <Badge tone={taskTones[task.state]} class="shrink-0 px-1 py-0">{taskLabels[task.state]}</Badge>
    </div>
    {#if task.failure}
      <p class="border-t border-border px-2.5 py-2 text-caption text-danger">{task.failure}</p>
    {/if}
    {#if task.todos.length}
      <ul class="space-y-1 border-t border-border px-2.5 py-2">
        {#each task.todos as todo (todo.id)}
          <li class="flex items-start gap-2 text-caption">
            <span class="mt-px shrink-0 text-muted" aria-hidden="true">{todoMarks[todo.state]}</span>
            <span class={todo.state === 'done' ? 'text-muted line-through' : 'text-secondary'}>
              {todo.text}
            </span>
          </li>
        {/each}
      </ul>
    {/if}
  </div>

  {#if task.plan}
    {@const plan = task.plan}
    <div class="space-y-2 rounded-control border border-intel/25 bg-intel/8 p-2.5">
      <div class="flex items-center gap-2">
        <ListChecks class="size-4 shrink-0 text-intel" />
        <span class="min-w-0 flex-1 truncate text-label font-medium text-intel">{plan.title}</span>
        <Badge tone={plan.accepted ? 'success' : 'attention'} class="shrink-0 px-1 py-0">
          {plan.accepted ? 'Accepted' : 'Draft'}
        </Badge>
      </div>
      {#if plan.summary}
        <p class="text-caption text-secondary">{plan.summary}</p>
      {/if}
      {#if plan.steps.length}
        <ol class="space-y-1.5">
          {#each plan.steps as step, index (step.id)}
            <li class="flex gap-2">
              <span
                class="flex size-5 shrink-0 items-center justify-center rounded-full border border-intel/30 bg-intel/10 text-caption font-medium text-intel"
              >
                {index + 1}
              </span>
              <div class="min-w-0 pt-px">
                <p class="text-label font-medium text-secondary">{step.title}</p>
                {#if step.description}
                  <p class="mt-0.5 text-caption text-muted">{step.description}</p>
                {/if}
              </div>
            </li>
          {/each}
        </ol>
      {/if}
      {#if !plan.accepted}
        <Button variant="primary" size="sm" class="w-full" onclick={() => acceptAiPlan()}>
          <CircleCheck class="size-3.5" />
          Accept plan
        </Button>
      {/if}
    </div>
  {/if}
{/if}
