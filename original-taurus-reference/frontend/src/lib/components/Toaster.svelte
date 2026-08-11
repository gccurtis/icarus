<script lang="ts">
  import { fly } from 'svelte/transition';
  import { cn } from '$lib/utils';
  import { motionDuration, EASE } from '$lib/motion';
  import { toasts, dismiss } from '$lib/toast';
  import type { Tone } from './types';

  const accent: Record<Tone, string> = {
    neutral: 'border-l-border-strong',
    action: 'border-l-action',
    intel: 'border-l-intel',
    focus: 'border-l-focus',
    attention: 'border-l-attention',
    success: 'border-l-success',
    danger: 'border-l-danger'
  };
</script>

<div class="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-80 flex-col gap-2" aria-live="polite">
  {#each $toasts as t (t.id)}
    <div
      transition:fly={{ y: 12, duration: motionDuration(220), easing: EASE }}
      class={cn(
        'surface-elevated pointer-events-auto flex items-start gap-3 border-l-4 p-3 text-body-sm',
        accent[t.tone]
      )}
    >
      <span class="flex-1 text-secondary">{t.message}</span>
      <button
        type="button"
        aria-label="Dismiss"
        onclick={() => dismiss(t.id)}
        class="dur-micro rounded-full p-0.5 text-muted transition-colors hover:text-primary"
      >
        <svg
          class="size-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2.5"
          stroke-linecap="round"
          aria-hidden="true"><path d="M18 6 6 18M6 6l12 12" /></svg
        >
      </button>
    </div>
  {/each}
</div>
