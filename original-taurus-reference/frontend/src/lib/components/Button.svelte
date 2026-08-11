<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '$lib/utils';
  import type { Size } from './types';
  import Spinner from './Spinner.svelte';

  type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger' | 'success' | 'danger-secondary' | 'intel-secondary' | 'plain';

  let {
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    borderless = false,
    type = 'button',
    href = undefined,
    class: className = '',
    children,
    ...rest
  }: {
    variant?: Variant;
    size?: Size;
    loading?: boolean;
    disabled?: boolean;
    borderless?: boolean;
    type?: 'button' | 'submit' | 'reset';
    href?: string;
    class?: string;
    children?: Snippet;
    [key: string]: unknown;
  } = $props();

  const variants: Record<Variant, string> = {
    primary: 'bg-action text-action-fg hover:opacity-90',
    secondary: 'bg-panel text-primary border border-border hover:bg-elevated',
    ghost: 'text-secondary hover:bg-panel',
    outline: 'border border-border-strong text-primary hover:bg-panel',
    danger: 'bg-danger text-white hover:opacity-90',
    success: 'bg-success text-white hover:opacity-90',
    'danger-secondary': 'text-primary border border-transparent hover:text-danger hover:border-danger/40 hover:bg-danger/5 active:bg-danger/10',
    'intel-secondary': 'text-primary border border-transparent hover:text-intel hover:border-intel/40 hover:bg-intel/5 active:bg-intel/10',
    'plain': 'text-primary border border-transparent hover:border-border hover:bg-elevated active:bg-panel',
  };

  const sizes: Record<Size, string> = {
    sm: 'h-8 gap-1.5 px-3 text-label',
    md: 'h-9 gap-2 px-4 text-body-sm',
    lg: 'h-11 gap-2 px-5 text-body'
  };

  const base =
    'dur-small inline-flex select-none items-center justify-center rounded-control font-medium transition-[color,background-color,opacity,box-shadow] disabled:pointer-events-none disabled:opacity-50';
</script>

{#if href}
  <a {href} class={cn(base, variants[variant], sizes[size], borderless && 'border-transparent', className)} {...rest}>
    {#if loading}<Spinner size={16} />{/if}
    {@render children?.()}
  </a>
{:else}
  <button
    {type}
    disabled={disabled || loading}
    class={cn(base, variants[variant], sizes[size], borderless && 'border-transparent', className)}
    {...rest}
  >
    {#if loading}<Spinner size={16} />{/if}
    {@render children?.()}
  </button>
{/if}
