<script lang="ts">
  import { cn } from '$lib/utils';

  let {
    src = undefined,
    name = '',
    size = 'md',
    class: className = ''
  }: {
    src?: string;
    name?: string;
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
    class?: string;
  } = $props();

  const sizes = {
    xs: 'size-6 text-caption',
    sm: 'size-8 text-label',
    md: 'size-9 text-body-sm',
    lg: 'size-11 text-body',
    xl: 'size-14 text-h4'
  } as const;

  const initials = $derived(
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('')
  );
</script>

{#if src}
  <img {src} alt={name} class={cn('rounded-full object-cover', sizes[size], className)} />
{:else}
  <span
    class={cn(
      'inline-flex items-center justify-center rounded-full bg-intel/15 font-medium text-intel',
      sizes[size],
      className
    )}
    aria-label={name || 'Avatar'}
  >
    {initials || '?'}
  </span>
{/if}
