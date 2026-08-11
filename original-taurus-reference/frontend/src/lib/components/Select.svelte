<script lang="ts">
  import { cn } from '$lib/utils';
  import type { Size } from './types';

  type Option = { value: string; label: string; disabled?: boolean };

  let {
    value = $bindable(''),
    options = [],
    placeholder = undefined,
    size = 'md',
    invalid = false,
    class: className = '',
    ...rest
  }: {
    value?: string;
    options?: Option[];
    placeholder?: string;
    size?: Size;
    invalid?: boolean;
    class?: string;
    [key: string]: unknown;
  } = $props();

  const sizes: Record<Size, string> = {
    sm: 'h-8 pl-2.5 pr-8 text-label',
    md: 'h-9 pl-3 pr-9 text-body-sm',
    lg: 'h-11 pl-3.5 pr-10 text-body'
  };
</script>

<div class={cn('relative inline-flex w-full', className)}>
  <select
    bind:value
    aria-invalid={invalid}
    class={cn(
      'dur-small w-full appearance-none rounded-control border bg-work text-primary transition-colors',
      invalid ? 'border-danger' : 'border-border hover:border-border-strong',
      sizes[size]
    )}
    {...rest}
  >
    {#if placeholder}
      <option value="" disabled selected={!value}>{placeholder}</option>
    {/if}
    {#each options as opt (opt.value)}
      <option value={opt.value} disabled={opt.disabled}>{opt.label}</option>
    {/each}
  </select>
  <svg
    class="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
</div>
