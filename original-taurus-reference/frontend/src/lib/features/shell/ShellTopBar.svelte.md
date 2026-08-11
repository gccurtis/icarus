# src/lib/features/shell/ShellTopBar.svelte — breakdown

Companion to [ShellTopBar.svelte](ShellTopBar.svelte). The workspace shell's top bar: a left project menu (with Project settings and back-to-projects) followed by the **Context / Templates** library nav, a faint centered wordmark that doubles as a light/dark toggle, and search / import / export / share / account controls on the right. The account menu opens the User settings and Organizations dialogs; the bar mounts those dialogs plus Share and Project settings at the end. It is deliberately uncluttered.

## Script — imports

### Navigation, icons, data stores, transfer, and the UI kit

```svelte
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

```

The imports assemble the bar's whole dependency set: `goto` for navigation, four Lucide icons, the session store plus `signOut`, project helpers and types, the workspace store and `openTab`, the theme toggle, the UI primitives, the `Wordmark`, and the four dialog components the bar opens.

This bar no longer imports any export machinery. Its Export menu is fully mocked (below), so the shared per-kind table in `$lib/features/shared/transfer` — which the editor bar and the resource rows use for real exports — is deliberately NOT wired here, and `$data/transfer`'s `exportProject` is currently unwired too. `exportTab` and `TAB_FORMATS` are gone from the codebase entirely: they wrote a real file with a fake body for every format, which reads as a successful export until you open it.

## Script — props and state

### The project props and the dialog open-state flags

```svelte
  let { projectName, projectId, icon }: { projectName: string; projectId: string; icon: IconColor } = $props();

  let settingsOpen = $state(false);
  let userSettingsOpen = $state(false);
  let organizationsOpen = $state(false);
  let shareOpen = $state(false);
  let fileInput = $state<HTMLInputElement>();

```

The bar is told which project it is showing via `projectName`, `projectId`, and `icon`. Five pieces of local state follow: four booleans that drive the Project-settings, User-settings, Organizations, and Share dialogs, and a reference to the hidden file `<input>` so the Import button can trigger it programmatically.

## Script — derived state

### The resolved project and the active tab

```svelte
  const project = $derived(
    $projects.find((p) => p.id === projectId) ??
      ({ id: projectId, name: projectName, role: 'owner', members: [], memberSummary: { items: [], total: 0 }, visibility: 'private', icon, purpose: '' } as Project)
  );
  const activeTab = $derived($workspace?.tabs.find((t) => t.id === $workspace?.activeTabId) ?? null);

```

`project` resolves the full record from the projects store, falling back to a synthesized project (built from the props, with an empty `members` roster and `memberSummary`) so export and settings still work before the store has loaded. `activeTab` reads the currently focused tab out of the workspace store, or `null` when there is none — it decides what a "This tab" export targets.

## Script — actions

### Back-to-projects navigation, the active-tab export, and the file-import handler

```svelte
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
    toast(`${what} isn't built yet — this menu is still being designed.`, { tone: 'attention' });
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

```

`backToProjects` navigates to the project picker.

`mockedShellExport(what)` is the whole of this menu's behaviour: one attention toast saying the thing is not built and the menu is still being designed. That is deliberate and is the state the control should stay in — the shell's Export is a **project-level** action whose shape is undecided (it may become Share; its options may end up an archive plus a package rather than document formats). The doc comment says so at length, including the instruction not to wire an item up opportunistically, because the failure mode here is specifically a menu that looks finished and hands back an empty file.

`onImport` handles the hidden input's change event: it takes the first chosen file, derives a tab title by stripping the extension (defaulting to "Imported"), opens a new tab, toasts confirmation, and clears the input's value so selecting the same file again still fires a change. The closing `</script>` ends the logic; markup follows.

## Markup — project menu and library nav

### The header, the left project menu, and the asset-space links

```svelte
<header class="surface-panel relative flex h-topbar shrink-0 items-center justify-between gap-3 px-3">
  <!-- Left: the project name (click reveals the menu), then the user/org-scoped
       asset spaces — routes, not workspace tabs (2026-07-28 plan). -->
  <div class="flex items-center gap-1">
    <Menu … label="Project menu" …>…</Menu>
    <nav class="ml-1 flex items-center gap-0.5" aria-label="Libraries">
      <Button variant="ghost" size="sm" href="/library/context">Context</Button>
      <Button variant="ghost" size="sm" href="/library/templates">Templates</Button>
    </nav>
  </div>

```

The `header` is a panel surface laid out as a three-region flex row of fixed top-bar height. The left region groups two things: the project `Menu`, whose trigger snippet shows the project's colored status dot (via `iconDotClass`) and its truncated name and whose items open Project settings or navigate back to the project list; and the **library nav** — Agents, Context, and Templates as labeled ghost buttons (navigation to new concepts gets words, not icons) linking to the `/library/*` spaces. Those spaces are user/org-scoped rather than project-scoped, which is why they live here in the chrome rather than as workspace tabs — Agents itself was a permanent tab until 2026-07-29, when it was promoted to the route for exactly that reason (the tab strip is now Overview plus resource tabs). Agents leads the nav because live agent work is the most time-sensitive thing the libraries hold.

## Markup — wordmark toggle

### The centered wordmark that toggles the theme

```svelte
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

```

The centered element is a button absolutely positioned at the horizontal midpoint (`left-1/2` with a `-translate-x-1/2` centering offset) so it stays centered independent of the flexing side regions. Clicking it calls `toggleTheme` to switch light/dark; it carries a `title` and `aria-label` for the non-obvious interaction, and the comment flags it as the swap point for a real logo.

## Markup — export menu

### Search, import, and the export menu

```svelte
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
```

The right region opens with Search (a placeholder icon button), Import (whose click forwards to the hidden file input), and the Export `Menu`. Export offers two items — a Taurus package and a ZIP archive — both suffixed `— mock` in their own label and both routed to `mockedShellExport`, so nothing downloads. Per-resource export lives elsewhere and is real: the editor bar's Export menu and each resource row's Download menu. A **Share** icon button follows, opening `ShareDialog` — real since workstream E (it renders the same `ProjectSharing` component Project settings does).

## Markup — account menu

### The account menu and the hidden file input

```svelte
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

```

The account `Menu` uses the signed-in user's `Avatar` as its trigger (falling back to "You" before the session resolves). Its items open the User settings and Organizations dialogs, then — after a divider — sign out and redirect to `/login` with `replaceState` so the workspace is not left in history. Closing the right `div` ends the three-region header; the hidden file `<input>`, bound to `fileInput` and wired to `onImport`, sits inside the header so the Import button can click it.

## Markup — dialogs

### The user-settings, organizations, project-settings, and share dialogs

```svelte
<UserSettingsDialog bind:open={userSettingsOpen} />
<OrganizationsDialog bind:open={organizationsOpen} />
<ProjectSettingsDialog bind:open={settingsOpen} {projectId} onexit={() => goto('/projects')} />
<ShareDialog bind:open={shareOpen} {projectId} {projectName} />
```

The four dialogs mount as siblings of the header, each controlled by `bind:open` against its state flag so a menu item (or the Share button) flipping the flag opens the corresponding dialog. `ProjectSettingsDialog` also receives the `projectId` and an `onexit` that navigates back to the project list — used when the project is deleted or left from within its settings; `ShareDialog` receives **both** `projectId` (the sharing controls act on it) and `projectName` (its framing sentence) — it took only the name while it was a mock.
