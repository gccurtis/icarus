<script lang="ts">
  import { cn } from '$lib/utils';
  import type { Size } from './types';

  let {
    value = $bindable(''),
    size = 'md',
    invalid = false,
    class: className = '',
    ...rest
  }: {
    value?: string;
    size?: Size;
    invalid?: boolean;
    class?: string;
    [key: string]: unknown;
  } = $props();

  const sizes: Record<Size, string> = {
    sm: 'h-8 px-2.5 text-label',
    md: 'h-9 px-3 text-body-sm',
    lg: 'h-11 px-3.5 text-body'
  };
</script>

<input
  bind:value
  aria-invalid={invalid}
  class={cn(
    'dur-small w-full rounded-control border bg-work text-primary transition-colors placeholder:text-muted',
    invalid ? 'border-danger' : 'border-border hover:border-border-strong',
    sizes[size],
    className
  )}
  {...rest}
/>
