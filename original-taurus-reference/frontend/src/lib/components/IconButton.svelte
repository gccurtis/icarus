<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils';
  import type { Size } from './types';

  type Variant = 'ghost' | 'secondary' | 'primary' | 'outline';

  let {
    variant = 'ghost',
    size = 'md',
    label,
    disabled = false,
    class: className = '',
    children,
    ...rest
  }: {
    variant?: Variant;
    size?: Size;
    /** Required accessible name for the icon-only control. */
    label: string;
    disabled?: boolean;
    class?: string;
    children?: Snippet;
    [key: string]: unknown;
  } = $props();

  const variants: Record<Variant, string> = {
    ghost: 'text-secondary hover:bg-panel',
    secondary: 'bg-panel text-primary border border-border hover:bg-elevated',
    primary: 'bg-action text-action-fg hover:opacity-90',
    outline: 'border border-border-strong text-primary hover:bg-panel'
  };

  const sizes: Record<Size, string> = { sm: 'size-8', md: 'size-9', lg: 'size-11' };
</script>

<button
  aria-label={label}
  title={label}
  {disabled}
  class={cn(
    'dur-small inline-flex items-center justify-center rounded-control transition-colors disabled:pointer-events-none disabled:opacity-50',
    variants[variant],
    sizes[size],
    className
  )}
  {...rest}
>
  {@render children?.()}
</button>
