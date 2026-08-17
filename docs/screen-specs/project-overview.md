# Project Overview

## Role in the workbench

Project Overview is the permanent first tab and the landing surface for a project. It gives a readable account of what exists, what changed, and what the user can create next. It is not a folder with a stored resource array: every resource list is a project-scoped query across the relevant tables.

## Center surface

### 1. Project header

- Project name and optional description.
- Active/archived status.
- Current user's owner/editor/viewer role.
- Compact member presence strip when an ephemeral presence channel exists; `lastSeenAt` is not live presence.
- Owner-only project-settings action.

The header remains compact. Full membership and project configuration belong in the inspector or settings flow.

### 2. Create row

The primary, always-visible actions are:

- New document.
- New slide deck.
- New spreadsheet.
- Upload file.
- More: research thread, analysis, connector, context, template, Persona, or Automation.

Document, slides, and spreadsheet actions may open [New Tab](new-tab.md) with that target preselected when a template decision is useful; a modifier or secondary action may create a blank resource immediately.

### 3. Project work table

The central table is the broad project inventory. It deliberately distinguishes persisted `ResourceKind` rows from other openable project work:

```ts
type ProjectItemRef =
  | { kind: "resource"; resourceType: ResourceKind; resourceId: string }
  | { kind: "research"; id: string }
  | { kind: "analysis"; id: string }
  | { kind: "context"; id: string };
```

This UI union prevents a Research thread or Context from being passed as a `ResourceRef`. Columns are:

| Column | Content |
| --- | --- |
| Name | Resource icon and title/name |
| Kind | Resource kind or project-work kind |
| Updated | Relative time with exact timestamp on demand |
| Updated by | Kind-specific actor when stored, otherwise latest attributable Activity when available, otherwise an em dash |
| Status | Extraction, connector, stale-output, or sync problem only when applicable |

Controls above the table provide search, kind filter, updated-by filter where attributable, sort, and list/dense display. Selecting a row inspects it; double-click, Enter, or an explicit Open action dispatches by `ProjectItemRef`:

- Document/slides/spreadsheet, Research, and Analysis open or activate their workbench tab.
- Context selects it in the project Context screen.
- Template selects it in Templates.
- Finding, external file, and connector remain in the Overview/owning screen and open a detailed Inspector unless a later dedicated tab kind is defined.

The table federates project-scoped queries rather than assuming `project.resources` exists. Queries are cursor-paginated or virtualized, show loaded/total counts only when the backend can supply both, and preserve a selected item across filtering only while it remains in the result set. Arrow keys move one row; Shift extends selection only for batch actions that are actually implemented.

### 4. Activity

A compact activity stream follows or sits beside the resource table at wide widths. It uses digests for repetitive activity and exposes:

- Actor.
- Human-readable action.
- Target.
- Optional containing context.
- Time.

Selecting an event inspects its complete attribution and navigation target. “View all” activates the Activity context-panel view without leaving the tab.

### 5. Attention summary

Show this strip only when something needs attention:

- Connector needs authentication or has a sync error.
- External-file extraction is unsupported or failed.
- Derived output is stale or errored.
- Agent task is waiting or failed.
- A direct-edit form has a preserved stale-write conflict.

Healthy background machinery should not occupy permanent dashboard space.

## Context panel

| Key | Label | Contents and organization |
| --- | --- | --- |
| `resources` | Resources | Default. Search plus collapsible kind groups. Open resources and show counts. Files and connectors keep their health badges. |
| `activity` | Activity | Time, actor, target-kind, and verb filters above a chronological list. Digest groups start collapsed after the newest entry. Activity has no native status field. |
| `tasks` | Tasks | Canonical overview of healthy and unhealthy project Agent Tasks: waiting first, then running, failed, and recent completed, with persona, origin, and plan progress. Opens task detail through Copilot Inspector takeover and links to Manage Personas. |
| `health` | Health | Connector, extraction, observable knowledge, derived-output, Automation, and sync problems. Healthy systems collapse to a compact “No issues” state and the footer opens Automations. |
| `contexts` | Context | Saved Resource Sets, short expression summaries, resolution problems, Create, and **Open Context screen**. |
| `templates` | Templates | Project and global templates grouped by document/slides/spreadsheet, with Create and **Open Templates screen**. |

The Context and Templates icons are permanent on this screen even if their lists are empty. This creates the initial route to their full screens before a global navigation scheme is finalized.

## Inspector targets

### Project or nothing selected

- **Identity** — name, description, active/archived state, current role; expanded.
- **People** — role counts and owner memberships; expanded. The model permits multiple owners and requires at least one.
- **Dates** — Convex creation time and `updatedAt`; collapsed. Project has no creator/updater actor fields.
- **Project actions** — settings, archive/restore; collapsed and permission-gated.

### Resource row

- **Identity** — icon, title, kind, open action; expanded.
- **Status** — sync/extraction/derived state where relevant; expanded only on warning.
- **Provenance** — only fields supported by the selected kind: creator/updater where stored, template origin where applicable, timestamps, and latest attributable activity when available; collapsed.
- **Relationships** — linked question, hypothesis, context, or connector when queryable; collapsed.
- **Actions** — open, duplicate where supported, archive/delete where modeled and authorized.

### Activity event

- **Activity** — resolved actor label, verb, target, containing context, timestamp; expanded.
- **Details** — event detail and source IDs; collapsed.
- **Navigation** — open target/open context.

### Member

- **Identity** — display name, email, image, last seen; expanded.
- **Access** — owner/editor/viewer; expanded. Role changes and removal route to Project settings rather than turning Overview into a membership-admin screen.

### External file

- **File** — title, type, MIME type, bytes, origin; expanded.
- **Extraction** — pending/ready/unsupported/error, extracted text/page count/dimensions where available, `extractedAt`, and error detail; expanded when not ready.
- **Version chain** — replaced/superseding file; collapsed.
- **Connector** — originating connector and whether it still synchronizes; collapsed.

### Connector

- **Connection** — provider, display name, status; expanded.
- **Scope and delivery** — explicit scopes and delivery mode; expanded.
- **Synchronization** — last sync, error, file count; expanded on warning.
- **Actions** — reconnect, sync now, disconnect/delete subject to permissions.

### Context, template, question, hypothesis, finding, analysis, or task

Use that object's dedicated inspector sections from its owning screen, plus an Open action. Do not flatten every kind into generic metadata.

## Empty and permission states

- A new project leads with the Create row and three primary blank-resource cards.
- A viewer sees create controls disabled with an access explanation, not removed without explanation.
- An archived project is visibly read-only and offers Restore only to an owner.
- Empty Context and Templates panel views explain the object and retain their full-screen actions.
- Large-project loading distinguishes no project work from no rows matching the current filter and from more rows still loading.

## Retained tab view state

This screen uses the `project-overview` branch of `WorkbenchTabState`: active context, panel geometry, one typed resource/activity/task/health selection, resource query and kind filters, and center scroll. It restores those fields on a tab switch. Exact inspector focus may clear on reload if the selected object no longer resolves.

## Model coverage

- [Project and membership](../data-models/core/project.md)
- [Activity](../data-models/collaboration/activity.md)
- [External files](../data-models/special-resources/external-file.md)
- [Connectors](../data-models/special-resources/connector.md)
- [Resource Sets](../data-models/special-resources/resource-set.md)
- [Templates](../data-models/special-resources/template.md)
