<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils';

  let {
    checked = $bindable(false),
    disabled = false,
    label = undefined,
    class: className = '',
    children,
    ...rest
  }: {
    checked?: boolean;
    disabled?: boolean;
    label?: string;
    class?: string;
    children?: Snippet;
    [key: string]: unknown;
  } = $props();
</script>

<label
  class={cn(
    'inline-flex items-center gap-2 text-body-sm text-primary',
    disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
    className
  )}
>
  <input type="checkbox" bind:checked {disabled} class="peer sr-only" {...rest} />
  <span
    class={cn(
      'dur-micro flex size-[18px] items-center justify-center rounded-[5px] border transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus',
      checked ? 'border-action bg-action' : 'border-border-strong bg-work'
    )}
  >
    {#if checked}
      <svg
        class="size-3 text-action-fg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="3"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M20 6 9 17l-5-5" />
      </svg>
    {/if}
  </span>
  {#if children}{@render children()}{:else if label}<span>{label}</span>{/if}
</label>
