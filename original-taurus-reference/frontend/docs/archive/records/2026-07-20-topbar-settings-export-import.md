# Change record — 2026-07-20 — Top bar: project settings, export, import

Top-bar actions: reach project settings from the project menu, export a tab or the
whole project, and import a file into a new tab. Kept deliberately uncluttered.

## Project settings from the project menu

```svelte
<!-- ShellTopBar: project menu → { Project settings → modal, Back to projects } -->
<ProjectSettingsDialog bind:open={settingsOpen} {projectId} />
```

**Why:** settings should be reachable inside a project, not only from the list.
**Purpose/why this way:** the project-name dropdown gains "Project settings" which
opens the existing `ProjectSettingsDialog` (reused) for the current project.

## Export (tab + project package)

```ts
// src/lib/data/transfer.ts — exportTab(tab, format, project) / exportProject(project, ws)
```

**Why:** we need download/export. **Purpose:** export the active tab in a chosen
format (Taurus `.taurus`, Markdown, Text, JSON) or the whole project as a `.taurus`
package. **Why this way:** the download mechanics and formats are real; tab content
is a placeholder note (no editor yet), while the project package is real frontend
state (project metadata + tabs + panel state). Surfaced as an Export menu in the top
bar. Per-format serializers fill in when real content/tab-types land.

## Import

```svelte
<!-- ShellTopBar: Import button → hidden file input → openTab(fileName) -->
```

**Why:** quick way to pull a file in. **Purpose:** pick a file and open it as a new
tab automatically. **Why this way:** a real file picker + tab creation named after
the file; the "determine how to parse it" step is a stub until the editor exists.

## Uncluttered top bar

**Why:** the top bar shouldn't get busy. **Purpose/why this way:** kept Search,
added Import + Export, dropped the notifications icon; deeper project actions live in
the project menu / settings modal, and everything else belongs in the content/panels.
