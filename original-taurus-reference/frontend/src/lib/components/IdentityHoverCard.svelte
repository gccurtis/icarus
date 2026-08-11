<script lang="ts">
  import { fade } from 'svelte/transition';
  import { Avatar, Badge, MockBadge } from '$lib/components';
  import type { IdentityProfile } from '$data/identity-directory';
  import { motionDuration } from '$lib/motion';
  import { cn } from '$lib/utils';

  let {
    profile,
    showAvatar = true,
    showName = false,
    size = 'xs',
    align = 'left',
    portalled = false,
    class: className = '',
    avatarClass = ''
  }: {
    profile: IdentityProfile;
    showAvatar?: boolean;
    showName?: boolean;
    size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
    align?: 'left' | 'right';
    /** Render the tooltip at a fixed position so it escapes overflow containers. */
    portalled?: boolean;
    class?: string;
    avatarClass?: string;
  } = $props();

  let open = $state(false);
  let trigger = $state<HTMLButtonElement>();
  let portalPos = $state({ x: 0, y: 0 });

  const kindLabel = $derived(profile.kind === 'persona' ? 'AI persona' : 'Person');
  const createdLabel = $derived.by(() => {
    if (!profile.createdAt) return '';
    const date = new Date(profile.createdAt);
    if (Number.isNaN(date.valueOf())) return '';
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  });

  function show() {
    if (portalled && trigger) {
      const r = trigger.getBoundingClientRect();
      portalPos = { x: r.left, y: r.bottom + 6 };
    }
    open = true;
  }
  function hide() {
    open = false;
  }
</script>

<button
  type="button"
  bind:this={trigger}
  class={cn(
    'dur-micro relative inline-flex max-w-full items-center gap-1.5 rounded-control p-0.5 text-caption text-secondary transition-colors hover:bg-elevated hover:text-primary',
    className
  )}
  aria-label={`View ${profile.kind === 'persona' ? 'AI persona' : 'person'} profile for ${profile.name}`}
  aria-expanded={open}
  onmouseenter={show}
  onmouseleave={hide}
  onfocus={show}
  onblur={hide}
  onclick={show}
>
  {#if showAvatar}
    <Avatar
      src={profile.avatarUrl}
      name={profile.name}
      {size}
      class={cn(profile.kind === 'persona' ? 'ring-1 ring-intel/30' : '', avatarClass)}
    />
  {/if}
  {#if showName}
    <span class="truncate">{profile.name}</span>
  {/if}

  {#if open}
    <span
      role="tooltip"
      transition:fade={{ duration: motionDuration(100) }}
      class={cn(
        'surface-elevated z-50 w-56 p-3 text-left normal-case',
        portalled
          ? 'pointer-events-none fixed'
          : 'absolute top-full mt-2',
        !portalled && align === 'right' ? 'right-0' : ''
      )}
      style={portalled ? `left: ${portalPos.x}px; top: ${portalPos.y}px;` : undefined}
    >
      <span class="flex items-start gap-2.5">
        <Avatar
          src={profile.avatarUrl}
          name={profile.name}
          size="md"
          class={profile.kind === 'persona' ? 'ring-1 ring-intel/30' : ''}
        />
        <span class="min-w-0 flex-1">
          <span class="flex items-center gap-1.5">
            <span class="truncate text-body-sm font-medium text-primary">{profile.name}</span>
            <Badge tone={profile.kind === 'persona' ? 'intel' : 'neutral'} class="shrink-0 px-1.5 py-0">
              {kindLabel}
            </Badge>
          </span>
          {#if profile.email}
            <span class="mt-0.5 block truncate text-caption text-muted">{profile.email}</span>
          {/if}
        </span>
      </span>

      <span class="mt-2 block text-caption leading-relaxed text-secondary">
        {profile.description}
      </span>

      <span class="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-border pt-2 text-caption text-muted">
        <span>{profile.role}</span>
        {#if createdLabel}
          <span>Created {createdLabel}</span>
        {/if}
        {#if profile.mock}
          <MockBadge class="px-1.5 py-0" />
        {/if}
      </span>
    </span>
  {/if}
</button>
