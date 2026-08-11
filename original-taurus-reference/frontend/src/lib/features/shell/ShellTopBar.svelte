<script lang="ts">
  import { goto } from '$app/navigation';
  import { Search, Download, Upload, Share2 } from '@lucide/svelte';
  import { session, signOut } from '$data/session';
  import { iconDotClass, projects, type Project, type IconColor } from '$data/projects';
  import { workspace, openTab } from '$data/workspace';
  import { toggleTheme } from '$lib/theme';
  import { Button, IconButton, Menu, Avatar, toast } from '$lib/components';
  import Wordmark from './Wordmark.svelte';
  import UserSettingsDialog from './UserSettingsDialog.svelte';
  import OrganizationsDialog from './OrganizationsDialog.svelte';
  import ProjectSettingsDialog from '$lib/features/projects/ProjectSettingsDialog.svelte';
  import ShareDialog from './ShareDialog.svelte';

  let { projectName, projectId, icon }: { projectName: string; projectId: string; icon: IconColor } = $props();

  let settingsOpen = $state(false);
  let userSettingsOpen = $state(false);
  let organizationsOpen = $state(false);
  let shareOpen = $state(false);
  let fileInput = $state<HTMLInputElement>();

  const project = $derived(
    $projects.find((p) => p.id === projectId) ??
      ({ id: projectId, name: projectName, role: 'owner', members: [], memberSummary: { items: [], total: 0 }, visibility: 'private', icon, purpose: '' } as Project)
  );
  const activeTab = $derived($workspace?.tabs.find((t) => t.id === $workspace?.activeTabId) ?? null);

  const backToProjects = () => goto('/projects');

  /**
   * The shell's Export is DELIBERATELY, ENTIRELY MOCKED — nothing here writes a
   * file. This is a **project-level** export whose shape is undecided: it may
   * become a Share control, and its options may end up being an archive and a
   * Taurus package rather than document formats. Until that is designed, every
   * item says so.
   *
   * Do not "helpfully" wire one of these up. Per-RESOURCE export is a different
   * feature and already real: the editor's Export menu and each resource row's
   * Download menu both run the per-kind table in `features/shared/transfer.ts`.
   * This menu previously carried an invented format list (.taurus/.md/.txt/.json)
   * that wrote placeholder files with none of your content — that is what was
   * removed, and a real-looking file is exactly what must not come back here.
   */
  function mockedShellExport(what: string) {
    toast(`${what} isn’t built yet — this menu is still being designed.`, { tone: 'attention' });
  }

  function onImport(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const title = file.name.replace(/\.[^.]+$/, '') || 'Imported';
    openTab(title);
    toast(`Imported "${file.name}" into a new tab`, { tone: 'success' });
    input.value = '';
  }
</script>

<header class="surface-panel relative flex h-topbar shrink-0 items-center justify-between gap-3 px-3">
  <!-- Left: the project name (click reveals the menu), then the user/org-scoped
       asset spaces — routes, not workspace tabs (2026-07-28 plan). -->
  <div class="flex items-center gap-1">
    <Menu
      align="start"
      label="Project menu"
      triggerClass="dur-small flex items-center gap-2 rounded-control px-2 py-1 text-body-sm font-medium text-primary transition-colors hover:bg-elevated"
      items={[
        { label: 'Project settings', onselect: () => (settingsOpen = true) },
        { divider: true },
        { label: 'Back to projects', onselect: backToProjects }
      ]}
    >
      {#snippet trigger()}
        <span class="size-2 rounded-full {iconDotClass(icon)}"></span>
        <span class="max-w-48 truncate">{projectName}</span>
      {/snippet}
    </Menu>
    <nav class="ml-1 flex items-center gap-0.5" aria-label="Libraries">
      <Button variant="ghost" size="sm" href="/library/agents">Agents</Button>
      <Button variant="ghost" size="sm" href="/library/context">Context</Button>
      <Button variant="ghost" size="sm" href="/library/templates">Templates</Button>
    </nav>
  </div>

  <!-- Center: faint wordmark doubles as a light/dark toggle (swap-point for a logo) -->
  <button
    type="button"
    onclick={toggleTheme}
    title="Switch light / dark"
    aria-label="Switch light or dark theme"
    class="dur-small absolute left-1/2 -translate-x-1/2 rounded-control px-2 py-1 transition-colors hover:bg-elevated"
  >
    <Wordmark />
  </button>

  <!-- Right: search, import, export, share, account -->
  <div class="flex items-center gap-1">
    <IconButton label="Search" size="sm"><Search class="size-4" /></IconButton>
    <IconButton label="Import" size="sm" onclick={() => fileInput?.click()}>
      <Upload class="size-4" />
    </IconButton>
    <Menu
      align="end"
      label="Export"
      triggerClass="dur-small flex size-8 items-center justify-center rounded-control text-secondary transition-colors hover:bg-panel hover:text-primary"
      items={[
        {
          label: 'Taurus package (.taurus) — mock',
          onselect: () => mockedShellExport('Project export')
        },
        {
          label: 'ZIP archive (.zip) — mock',
          onselect: () => mockedShellExport('Archive export')
        }
      ]}
    >
      {#snippet trigger()}<Download class="size-4" />{/snippet}
    </Menu>
    <IconButton label="Share" size="sm" onclick={() => (shareOpen = true)}>
      <Share2 class="size-4" />
    </IconButton>
    <Menu
      align="end"
      label="Account"
      triggerClass="ml-1 rounded-full outline-offset-2"
      items={[
        { label: 'User settings', onselect: () => (userSettingsOpen = true) },
        { label: 'Organizations', onselect: () => (organizationsOpen = true) },
        { divider: true },
        { label: 'Sign out', onselect: async () => { await signOut(); goto('/login', { replaceState: true }); } }
      ]}
    >
      {#snippet trigger()}<Avatar name={$session.user?.name ?? 'You'} size="sm" />{/snippet}
    </Menu>
  </div>

  <input bind:this={fileInput} type="file" class="hidden" onchange={onImport} />
</header>

<UserSettingsDialog bind:open={userSettingsOpen} />
<OrganizationsDialog bind:open={organizationsOpen} />
<ProjectSettingsDialog bind:open={settingsOpen} {projectId} onexit={() => goto('/projects')} />
<ShareDialog bind:open={shareOpen} {projectId} {projectName} />
