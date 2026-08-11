<script lang="ts">
  import type { Snippet } from 'svelte';
  import { goto } from '$app/navigation';
  import { ArrowLeft, Moon, Sun } from '@lucide/svelte';
  import { session, signOut } from '$data/session';
  import { workspace } from '$data/workspace';
  import { theme, toggleTheme } from '$lib/theme';
  import { Avatar, Button, IconButton, Menu, MockBadge, TopBar } from '$lib/components';

  // The frame every library space shares: top bar (back, the space nav, the Mock
  // badge, theme, account), the auth bounce, and the three-column body the space
  // fills. These are ROUTES, not workspace tabs — they must be reachable from
  // project selection too, where there is no tab strip.
  let {
    space,
    title,
    children
  }: { space: 'agents' | 'context' | 'templates'; title: string; children: Snippet } = $props();

  // Bounce anonymous users once the session hydrates — same rule as /projects.
  $effect(() => {
    if ($session.ready && !$session.user) goto('/login', { replaceState: true });
  });

  // Back means ONE thing: back to the project you were in. Not browser history —
  // the spaces cross-link, so a history-based Back mostly landed on another
  // library space, which is confusing and goes nowhere. `workspace` still holds
  // the last project entered this session; a cold deep link has none, so the
  // project list is the honest destination.
  function back() {
    const projectId = $workspace?.projectId;
    goto(projectId ? `/projects/${projectId}` : '/projects');
  }
</script>

<svelte:head><title>{title} · Taurus</title></svelte:head>

<!-- No <Toaster/> here: the root layout mounts the app-wide one (2026-07-28 fix),
     and a second mount renders every toast twice — caught by the agents e2e. -->

<div class="flex h-screen flex-col bg-canvas text-primary">
  <TopBar>
    {#snippet start()}
      <IconButton
        label="Back"
        title={$workspace?.projectId ? 'Back to project' : 'Back to projects'}
        onclick={back}
      >
        <ArrowLeft class="size-4" />
      </IconButton>
      <span class="size-2.5 rounded-full bg-focus"></span>
      <span class="text-label font-semibold tracking-tight">Taurus</span>
      <nav class="ml-2 flex items-center gap-0.5" aria-label="Libraries">
        <Button
          variant="ghost"
          size="sm"
          href="/library/agents"
          class={space === 'agents' ? 'text-primary' : 'text-muted'}
        >
          Agents
        </Button>
        <Button
          variant="ghost"
          size="sm"
          href="/library/context"
          class={space === 'context' ? 'text-primary' : 'text-muted'}
        >
          Context
        </Button>
        <Button
          variant="ghost"
          size="sm"
          href="/library/templates"
          class={space === 'templates' ? 'text-primary' : 'text-muted'}
        >
          Templates
        </Button>
      </nav>
      <MockBadge class="ml-1" />
    {/snippet}
    {#snippet end()}
      <IconButton label={$theme === 'celestial' ? 'Dark mode' : 'Light mode'} onclick={toggleTheme}>
        {#if $theme === 'celestial'}<Moon class="size-4" />{:else}<Sun class="size-4" />{/if}
      </IconButton>
      <Menu
        align="end"
        label="Account"
        triggerClass="rounded-full outline-offset-2"
        items={[
          {
            label: 'Sign out',
            onselect: async () => {
              await signOut();
              goto('/login', { replaceState: true });
            }
          }
        ]}
      >
        {#snippet trigger()}<Avatar name={$session.user?.name ?? 'You'} size="sm" />{/snippet}
      </Menu>
    {/snippet}
  </TopBar>

  <div class="flex min-h-0 flex-1">
    {@render children()}
  </div>
</div>
