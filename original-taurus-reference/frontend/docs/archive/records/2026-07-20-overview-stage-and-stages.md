# Change record — 2026-07-20 — Overview stage, "stage" terminology, delete-bounce

Introduces the stage concept and the first stage (Overview, with a resource table),
renames the Resources destination to Agents, and makes an in-shell project delete
return to the project list.

## Terminology: screen / tab / stage

```md
# AGENTS.md → Terminology: Screen (a full view), Tab (an open destination/resource),
# Stage (the content a tab renders in the work surface). Stages live in
# src/lib/features/stages/.
```

**Why:** we needed a solid word for a tab's middle content. **Purpose/why this way:**
adopted **stage** (distinct from the docs' "work surface" region) and documented
screen/tab/stage in AGENTS.md so the vocabulary is consistent.

## Overview stage + mock resources

```ts
// src/lib/data/resources.ts — per-project mock resources (kinds, add/remove, persisted)
// src/lib/features/stages/OverviewStage.svelte — resource table
```

**Why:** the project needs an Overview stage centered on resources. **Purpose:** a
resource table with an Add button, filter pills (per kind, with counts) + search,
and per-row open (into a tab) / download / remove. **Why this way:** resources are a
client-only, per-project-isolated mock (persisted per id) standing in for Omega's
resources; kinds carry an icon + semantic tone; download writes a placeholder file
via the shared `downloadText` (exported from transfer.ts).

## Stage plumbing

```svelte
<!-- WorkSurface switches on the active tab: overview -> OverviewStage; agents /
     resource tabs -> placeholders. AppShell renders <WorkSurface tab={activeTab} …/>. -->
```

**Why:** the work surface must render the right stage per tab. **Purpose/why this
way:** a `WorkSurface` component switches on the active tab; new stages plug in as
branches. Renamed the permanent **Resources → Agents** (no resource stage; resources
live in Overview), with a `load()` reconcile so saved workspaces migrate the rename.

## In-shell delete returns to the project list

```svelte
<!-- ProjectSettingsDialog gains onexit; ShellTopBar passes goto('/projects'). -->
```

**Why:** deleting/leaving the current project from the shell left you on a dead page.
**Purpose/why this way:** the settings dialog fires an optional `onexit` after
delete/leave; the shell navigates back to `/projects` (the projects list passes no
`onexit`, so it just updates in place).
