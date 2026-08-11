# Change record — 2026-07-20 — Application shell

The workspace shell behind `/projects/[id]`: the chrome every screen shares (top
bar, tab strip), collapsible/resizable context + inspector panels, a floating
Quarterback, and a status bar — all frontend-only with a placeholder work surface.

## Per-project workspace store (strict isolation)

```ts
// src/lib/data/workspace.ts — tabs + panel state, keyed by project id in
// localStorage; enterProject(id) swaps the whole state.
export const workspace = writable<Workspace | null>(null);
```

**Why:** the shell needs tab/panel state, and project isolation is a design law.
**Purpose:** hold open tabs, the active tab, and each panel's width/collapsed.
**Why this way:** state is namespaced by project id (`taurus.ws.<id>`) and reloaded
on `enterProject`, so it persists per project yet never bleeds across projects.

## The shell layout

```svelte
<!-- AppShell: ShellTopBar / TabStrip / [SidePanel · work surface · SidePanel] +
     QuarterbackDock (floats) / StatusBar -->
```

**Why:** every project screen shares this frame. **Purpose:** a legible instrument
matching the shell reference. **Why this way:**
- **Top bar** — project name dropdown (→ Back to projects), a deliberately faint
  centered "taurus" wordmark, utility icons + account menu. No prominent branding.
- **Tab strip** — permanent destinations share the bar surface; resource tabs sit
  "in front" of a recessed (`bg-canvas`, inset-shadow) strip; `+` opens placeholder
  tabs; tabs open/close/switch (frontend-only).
- **Context + Inspector panels** — always-visible icon rail + an expandable panel;
  **drag the inner edge to resize** within min/max, drag past the min (or click the
  chevron) to **collapse to the rail**. The work surface keeps a min width so the
  middle never fully collapses.
- **Quarterback** — floats above the work surface, faded when idle, solid on
  focus/hover, doesn't take layout space.
- **Status bar** — thin infrastructural strip.

## Route

```svelte
<!-- /projects/[id] now renders <AppShell projectId projectName /> -->
```

**Why:** the stub becomes the real workspace. **Purpose:** host the shell for a
project. **Why this way:** client-only (ssr=false), guards auth, and loads the
projects list if you arrived directly so the name resolves; the work surface is a
placeholder pending the editor.

## Verification

`svelte-check` 0/0, production build clean, the `/projects/[id]` route serves 200
and Vite compiles the shell with no errors. Interactive behavior (drag-resize,
collapse, tab open/close, QB fade) is best confirmed in a browser via `pnpm dev:all`.
