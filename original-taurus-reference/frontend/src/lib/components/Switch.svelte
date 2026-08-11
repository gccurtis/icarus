<script lang="ts">
  import { cn } from '$lib/utils';

  let {
    checked = $bindable(false),
    disabled = false,
    label = undefined,
    class: className = '',
    ...rest
  }: {
    checked?: boolean;
    disabled?: boolean;
    label?: string;
    class?: string;
    [key: string]: unknown;
  } = $props();
</script>

<label
  class={cn(
    'inline-flex items-center gap-2.5 text-body-sm text-primary',
    disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer',
    className
  )}
>
  <input type="checkbox" role="switch" bind:checked {disabled} class="peer sr-only" {...rest} />
  <span
    class={cn(
      'dur-small relative h-5 w-9 rounded-full border transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus',
      checked ? 'border-action bg-action' : 'border-border-strong bg-panel'
    )}
  >
    <span
      class={cn(
        'dur-small absolute top-0.5 size-3.5 rounded-full bg-white shadow-panel transition-all',
        checked ? 'left-4' : 'left-0.5'
      )}
    ></span>
  </span>
  {#if label}<span>{label}</span>{/if}
</label>
