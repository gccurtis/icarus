# src/routes/projects/+page.svelte — breakdown

Companion to [+page.svelte](+page.svelte). The project selection screen, backed by
real Omega data: it loads the user's projects, shows each with role and member
identity hover cards, and offers create/open/delete/leave plus the settings dialog.

## Script — imports and load

### Wiring, state, guard, and loader

```svelte
<script lang="ts">
  import { goto } from '$app/navigation';
  import { Plus, MoreHorizontal, Sun, Moon, Lock, Link2 } from '@lucide/svelte';
  import { session, signOut } from '$data/session';
  import { isApiError } from '$data/api';
  import {
    projects,
    fetchProjects,
    openProject,
    leaveProject,
    iconTileClass,
    type Project,
    type Role
  } from '$data/projects';
  import { identityProfileFromMemberSummary } from '$data/identity-directory';
  import { Button, IconButton, IdentityHoverCard, Badge, Menu, EmptyState, TopBar, Avatar, Skeleton, toast } from '$lib/components';
  import CreateProjectDialog from '$lib/features/projects/CreateProjectDialog.svelte';
  import ProjectSettingsDialog from '$lib/features/projects/ProjectSettingsDialog.svelte';

  let createOpen = $state(false);
  let settingsOpen = $state(false);
  let settingsId = $state<string | null>(null);
  let loading = $state(true);
  let loaded = $state(false);

  // Once the session hydrates: bounce anonymous users, otherwise load projects.
  $effect(() => {
    if (!$session.ready) return;
    if (!$session.user) {
      goto('/login', { replaceState: true });
    } else if (!loaded) {
      loaded = true;
      load();
    }
  });

  async function load() {
    loading = true;
    try {
      await fetchProjects();
    } catch (e) {
      toast(isApiError(e) ? e.message : 'Could not load projects', { tone: 'danger' });
    } finally {
      loading = false;
    }
  }
```

The `$effect` waits for `$session.ready`, redirects anonymous users, and loads
projects exactly once for a signed-in user. `load` fetches real projects and
toasts a backend error, always clearing the `loading` flag.

## Script — actions

### Open, leave, and row menu

The theme toggle used to be an ad-hoc local `theme` state writing `data-theme` directly. That
fought the shared `$lib/theme` store (which mirrors to `<html data-theme>` and localStorage):
its initial state was always light regardless of the real theme, so the first click could
visually no-op, and nothing persisted. Since the 2026-07-28 library pass the page imports
`theme`/`toggleTheme` from `$lib/theme` like the rest of the app.

```svelte
  async function open(p: Project) {
    try {
      await openProject(p.id);
    } catch {
      // selecting the project cell is best-effort for the stub route today
    }
    goto(`/projects/${p.id}`);
  }

  async function leave(p: Project) {
    try {
      await leaveProject(p.id);
      toast('Left project');
    } catch (e) {
      toast(isApiError(e) ? e.message : 'Could not leave project', { tone: 'danger' });
    }
  }

  function openSettings(p: Project) {
    settingsId = p.id;
    settingsOpen = true;
  }

  function rowItems(p: Project) {
    const items: { label?: string; onselect?: () => void; danger?: boolean; divider?: boolean }[] = [
      { label: 'Open', onselect: () => open(p) }
    ];
    if (p.role === 'owner') {
      items.push({ label: 'Settings', onselect: () => openSettings(p) });
    } else {
      items.push({ divider: true }, { label: 'Leave project', danger: true, onselect: () => leave(p) });
    }
    return items;
  }

  const roleTone: Record<Role, 'action' | 'intel' | 'neutral'> = {
    owner: 'action',
    editor: 'intel',
    viewer: 'neutral'
  };
</script>
```

`open` selects the project (best-effort) then navigates into it; `leave` calls the
real endpoint. `rowItems` builds the kebab menu from an explicitly typed `items`
array — just Open, then gated by `p.role` (owners get Settings; others get Leave);
sharing now lives in the settings dialog's read/edit links rather than a Copy link
item. `roleTone` maps the role to a badge color.

## Markup — top bar

### Brand, library nav, theme toggle, account menu

```svelte

<svelte:head><title>Projects · Taurus</title></svelte:head>

{#if $session.user}
<div class="min-h-screen bg-canvas text-primary">
  <TopBar>
    {#snippet start()}
      <span class="size-2.5 rounded-full bg-focus"></span>
      <span class="text-label font-semibold tracking-tight">Taurus</span>
      <nav class="ml-2 flex items-center gap-0.5" aria-label="Libraries">
        <Button variant="ghost" size="sm" href="/library/agents">Agents</Button>
        <Button variant="ghost" size="sm" href="/library/context">Context</Button>
        <Button variant="ghost" size="sm" href="/library/templates">Templates</Button>
      </nav>
    {/snippet}
    {#snippet end()}
      <IconButton label="Toggle theme" onclick={toggleTheme}>
        {#if $theme === 'celestial'}<Moon class="size-4" />{:else}<Sun class="size-4" />{/if}
      </IconButton>
      <Menu
        align="end"
        label="Account"
        triggerClass="rounded-full outline-offset-2"
        items={[{ label: 'Sign out', onselect: async () => { await signOut(); goto('/login', { replaceState: true }); } }]}
      >
        {#snippet trigger()}<Avatar name={$session.user?.name ?? 'You'} size="sm" />{/snippet}
      </Menu>
    {/snippet}
  </TopBar>
```

The page renders under `{#if $session.user}` (with an `{:else}` loading state). The
`TopBar` shows the brand, then the **Agents / Context / Templates** library nav — the spaces are
user/org-scoped, so they must be reachable from project selection, not only inside a project
(2026-07-28 plan; the full workspace top bar was deliberately *not* copied here — search,
import/export, and share are project-scoped and meaningless on this screen). On the right, the
theme toggle (now the shared `$lib/theme` store) and account `Menu` (avatar trigger, async
Sign out). Inside the snippet closure the user is read with `?.` since the outer `{#if}`
narrowing doesn't reach into it.

## Markup — header, loading, empty

### Title, New project, and the pre-list states

```svelte

  <main class="mx-auto max-w-4xl px-5 py-10">
    <div class="flex items-end justify-between gap-4">
      <div>
        <h1 class="text-h2 font-semibold">Projects</h1>
        <p class="mt-1 text-body-sm text-muted">Enter a project to begin working.</p>
      </div>
      <Button onclick={() => (createOpen = true)}><Plus class="size-4" /> New project</Button>
    </div>

    {#if loading}
      <div class="mt-6 space-y-2">
        {#each [0, 1, 2] as i (i)}<Skeleton class="h-16 w-full rounded-panel" />{/each}
      </div>
    {:else if $projects.length === 0}
      <div class="mt-8">
        <EmptyState title="No projects yet" description="Create your first project to enter the citadel.">
          {#snippet action()}
            <Button onclick={() => (createOpen = true)}><Plus class="size-4" /> New project</Button>
          {/snippet}
        </EmptyState>
      </div>
    {:else}
```

The header pairs the title with New project. While loading, three `Skeleton` rows
show; with no projects, an `EmptyState` invites creating one; otherwise the list
renders.

## Markup — project rows

### The list, with member hover cards

```svelte
      <!-- No overflow-hidden here: it would clip the row hover cards and kebab
           menus. Corners are rounded on the header + last row instead. -->
      <div class="mt-6 rounded-panel border border-border">
        <div
          class="grid grid-cols-[1fr_auto_auto] items-center gap-4 rounded-t-panel border-b border-border bg-panel/50 px-4 py-2.5 text-label uppercase tracking-wide text-muted"
        >
          <span>Project</span>
          <span class="hidden sm:block">Members</span>
          <span class="sr-only">Actions</span>
        </div>

        {#each $projects as p (p.id)}
          <div
            class="dur-micro grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b border-border px-4 py-3 transition-colors last:rounded-b-panel last:border-0 hover:bg-panel/40"
          >
            <div class="flex min-w-0 items-center gap-3">
              <span
                class="flex size-8 shrink-0 items-center justify-center rounded-control text-label font-semibold {iconTileClass(p.icon)}"
              >
                {p.name[0]}
              </span>
              <div class="min-w-0">
                <a
                  href="/projects/{p.id}"
                  onclick={(e) => { e.preventDefault(); open(p); }}
                  class="dur-micro block truncate text-body-sm font-medium text-primary transition-colors hover:text-action"
                >
                  {p.name}
                </a>
                <div class="mt-0.5 flex items-center gap-2 text-caption text-muted">
                  <Badge tone={roleTone[p.role]}>{p.role}</Badge>
                  <span class="inline-flex items-center gap-1">
                    {#if p.visibility === 'link'}<Link2 class="size-3" /> Link{:else}<Lock class="size-3" /> Private{/if}
                  </span>
                </div>
              </div>
            </div>

            <div class="hidden items-center sm:flex">
              {#each p.memberSummary.items.slice(0, 3) as m (m.userId)}
                <IdentityHoverCard
                  profile={identityProfileFromMemberSummary(m)}
                  class="-ml-1.5 first:ml-0"
                  avatarClass="ring-2 ring-canvas"
                />
              {/each}
              {#if p.memberSummary.total > 3}
                <span
                  class="-ml-1.5 flex size-6 items-center justify-center rounded-full bg-panel text-caption text-muted ring-2 ring-canvas"
                >
                  +{p.memberSummary.total - 3}
                </span>
              {/if}
            </div>

            <Menu
              align="end"
              label="More options"
              triggerClass="dur-small inline-flex size-8 items-center justify-center rounded-control text-muted transition-colors hover:bg-panel hover:text-primary"
              items={rowItems(p)}
            >
              {#snippet trigger()}<MoreHorizontal class="size-4" />{/snippet}
            </Menu>
          </div>
        {/each}
      </div>
    {/if}
  </main>
</div>
{:else}
  <div class="flex min-h-screen items-center justify-center bg-canvas text-muted">
    <span class="text-body-sm">Loading…</span>
  </div>
{/if}
```

A three-column grid (Project / Members / actions — last-edited is dropped since
Omega doesn't return it). Each row shows a name-initial tile, the project name
(clicking it opens/selects the project), a role `Badge` + visibility, the member avatars —
the bounded `memberSummary` cluster (not the full `members` roster) — as `IdentityHoverCard`
hover cards, and the options `Menu`. The list container
deliberately avoids `overflow-hidden` so row hover cards and kebab menus aren't
clipped (a single short row would otherwise cut them off) — corners are rounded on
the header and last row instead. The `{:else}` is the pre-hydration loading
fallback.

## Dialogs

### Create and settings dialogs

```svelte

<CreateProjectDialog bind:open={createOpen} />
<ProjectSettingsDialog bind:open={settingsOpen} projectId={settingsId} />
```

Both are mounted once and driven by page state.
