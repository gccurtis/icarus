<script lang="ts">
  import { cn } from '$lib/utils';

  type Step = { label: string };

  let {
    steps = [],
    current = 0,
    class: className = ''
  }: { steps?: Step[]; current?: number; class?: string } = $props();
</script>

<ol class={cn('flex items-center', className)}>
  {#each steps as step, i (step.label)}
    {@const done = i < current}
    {@const active = i === current}
    <li class="flex items-center gap-2">
      <span
        class={cn(
          'flex size-7 items-center justify-center rounded-full border text-caption font-semibold tabular-nums transition-colors',
          done
            ? 'border-success bg-success text-white'
            : active
              ? 'border-action bg-action text-action-fg'
              : 'border-border-strong text-muted'
        )}
      >
        {#if done}
          <svg
            class="size-3.5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="3"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg
          >
        {:else}{i + 1}{/if}
      </span>
      <span class={cn('text-body-sm', active ? 'font-medium text-primary' : 'text-muted')}>
        {step.label}
      </span>
      {#if i < steps.length - 1}<span class="mx-3 h-px w-8 bg-border"></span>{/if}
    </li>
  {/each}
</ol>
