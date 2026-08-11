---
title: "Architecture — Application Routes, Screens & Scope Gates"
notion_page_id: "3adb6410e5028163bf85c5fe95a8a163"
notion_url: "https://app.notion.com/3adb6410e5028163bf85c5fe95a8a163"
project: "Taurus Yesod"
role: "Supporting"
format: "Spec"
created: "2026-07-30 05:31:05Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Architecture — Application Routes, Screens & Scope Gates

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

> **Decision:** Taurus Alpha has explicit route families with explicit scope gates. A User session identifies the person; navigation identifies the requested surface; every Project route or operation names its Project. User and organization screens do not depend on an active Project Workspace.
## Route families
<table header-row="true">
<tr>
<td>Family</td>
<td>Authentication</td>
<td>Project admission</td>
<td>Runtime</td>
</tr>
<tr>
<td>Public/authentication</td>
<td>none or resumable session</td>
<td>none</td>
<td>application/auth</td>
</tr>
<tr>
<td>Signed-in user</td>
<td>required</td>
<td>none</td>
<td>control-plane projection</td>
</tr>
<tr>
<td>Organization administration</td>
<td>required + admin grant</td>
<td>none for browsing administration</td>
<td>control-plane projection</td>
</tr>
<tr>
<td>Project directory/settings</td>
<td>required</td>
<td>fresh Project metadata/admin admission</td>
<td>control plane; no content runtime required</td>
</tr>
<tr>
<td>Project execution</td>
<td>required</td>
<td>fresh Project content admission</td>
<td>Project runtime + Workspace</td>
</tr>
<tr>
<td>Internal development</td>
<td>environment-gated</td>
<td>none unless fixture requires it</td>
<td>component/test harness</td>
</tr>
</table>
A route guard is a state machine, not a redirect scattered across component effects.
## Canonical screen and route map
The user, Project, and library URLs below are stable product contracts. Organization-administration child paths are representative route projections; the complete section registry and permission behavior remain governed by the Organization Administration authority.
<table header-row="true">
<tr>
<td>Route</td>
<td>Scope</td>
<td>Screen responsibility</td>
</tr>
<tr>
<td>`/`</td>
<td>public</td>
<td>boot/session-resume gate; redirects only after session status is known</td>
</tr>
<tr>
<td>`/login`</td>
<td>public</td>
<td>sign-in, expired-session recovery, safe return target</td>
</tr>
<tr>
<td>`/join/:token`</td>
<td>public/signed-in</td>
<td>inspect and accept invitation; preserve intended return through sign-in</td>
</tr>
<tr>
<td>`/projects`</td>
<td>signed-in user</td>
<td>Project directory, create/open/leave, recent and accessible Projects</td>
</tr>
<tr>
<td>`/library/context`</td>
<td>signed-in user</td>
<td>owner-scoped Context library</td>
</tr>
<tr>
<td>`/library/context/:contextId`</td>
<td>signed-in user</td>
<td>durable Context asset detail/edit route</td>
</tr>
<tr>
<td>`/library/templates`</td>
<td>signed-in user</td>
<td>owner-scoped Template library</td>
</tr>
<tr>
<td>`/library/templates/:templateId`</td>
<td>signed-in user</td>
<td>Template detail/edit route</td>
</tr>
<tr>
<td>`/library/agents`</td>
<td>signed-in user</td>
<td>cross-Project Agent/task monitor and Personality library entry</td>
</tr>
<tr>
<td>`/library/agents/:personalityId`</td>
<td>signed-in user</td>
<td>durable Personality detail/edit route</td>
</tr>
<tr>
<td>`/settings/account`</td>
<td>signed-in user</td>
<td>identity profile, license presentation, account security and personal settings</td>
</tr>
<tr>
<td>`/settings/preferences`</td>
<td>signed-in user</td>
<td>user-level application preferences; not Project Workspace state</td>
</tr>
<tr>
<td>`/admin/organizations/:rootOrganizationId`</td>
<td>organization admin</td>
<td>organization tree and administration home</td>
</tr>
<tr>
<td>`/admin/organizations/:rootOrganizationId/members`</td>
<td>organization admin</td>
<td>memberships, roles, invitations</td>
</tr>
<tr>
<td>`/admin/organizations/:rootOrganizationId/projects`</td>
<td>organization admin</td>
<td>owned Projects, custody, grants and allowed “Open Project” actions</td>
</tr>
<tr>
<td>`/admin/organizations/:rootOrganizationId/licensing`</td>
<td>organization admin</td>
<td>licenses, entitlements, policy presentation</td>
</tr>
<tr>
<td>`/projects/:projectId/settings`</td>
<td>admitted Project admin/member as applicable</td>
<td>Project metadata, sharing/access, connectors and danger actions</td>
</tr>
<tr>
<td>`/projects/:projectId`</td>
<td>admitted Project content user</td>
<td>browser workbench; Workspace chooses active tab/stage</td>
</tr>
<tr>
<td>`/projects/:projectId/agents`</td>
<td>admitted Project content user</td>
<td>canonical Project Agents deep route; performs fresh admission and activates the pinned `agents` system tab</td>
</tr>
<tr>
<td>`/components`</td>
<td>development only</td>
<td>live component catalog and states</td>
</tr>
</table>
Exact SvelteKit route files may be grouped differently. The Organization Administration experience must expose Overview, People, Organization, Projects, Access reviews, Security & identity, Plan & usage, Audit, and Danger. It may project those sections into nested paths, query-backed deep links, or one route with a section registry, but every section requires a durable deep-link/focus/recovery contract. The Organization Administration authority decides that mapping; this page must not narrow the console to only members, projects, and licensing.
## Project workbench surfaces
The Project workbench is one shell route. Its Workspace contains:
- a permanent Overview tab;
- a permanent Project Agents tab;
- a New Tab/resource creation surface;
- open Document, Spreadsheet, Slides, and Chat resource tabs;
- eligible file/resource preview stages;
- Context, Inspector, and Quarterback composition for the active tab.
There is no V1 permanent “Data” or “Board” screen. Structured resources appear in the Resource catalog and open as resource tabs. User Context, Templates, and Personality are not Project tabs; materializing one into a Project is an explicit command naming the target Project.
A resource tab is Workspace state, not a route segment. Deep linking may include a resource/tab hint, but resolving it becomes an explicit Workspace command after admission. The browser URL must not be the only record of open tabs. `/projects/:projectId/agents` is the deliberate exception for a canonical product destination: it admits the Project, acquires the frontend Project runtime, and activates the registry-owned Project Agents system tab. It is not the user-level `/library/agents` surface.
## Route entry state machine
```typescript
type RouteGate =
  | { phase: "checking-session" }
  | { phase: "signed-out"; returnTo: string }
  | { phase: "checking-admission"; projectId: string }
  | { phase: "ready"; scope: RouteScope }
  | { phase: "forbidden"; recovery: RecoveryAction[] }
  | { phase: "not-found" }
  | { phase: "failed"; fault: FrontendFault };

interface RouteDefinition {
  id: string;
  scope: RouteScopeKind;
  load(context: RouteLoadContext, signal: AbortSignal): Promise<RouteGate>;
}
```
A Project runtime mounts only after `ready` admission. If admission expires during use, the runtime stops new submissions, retains diagnosable pending state, refreshes admission, and either resumes or navigates to a typed access-revoked recovery screen.
## Navigation invariants
1. The session contains identity, not authoritative Project selection.
2. Every Project link contains or resolves an explicit ProjectID.
3. A “recent Project” is a navigation preference, not authorization.
4. Opening account, library, or organization administration never acquires or activates a Project Subcell. Signed-in user routes may use User Cell/control-plane facades, but no Project execution runtime is implied.
5. Organization ownership/custody/admin status does not imply content read permission.
6. “Open Project” performs fresh admission; it does not reuse an admin-console assumption.
7. Multiple browser tabs may navigate to different Projects without mutating shared ambient server scope.
8. Return targets are validated same-origin application routes; authentication flows do not accept open redirects.
9. Route loaders and guards own initial fetch/admission. Components do not repair missing route data with mount-time redirect loops.
10. Every route has explicit loading, empty, forbidden, not-found, offline, and failed states.
## Screen composition
### Authentication
The sign-in screen is a small public composition. It may share components and theme state, but it does not load Project or user-library runtimes. Session-expired messaging is specific and non-destructive. Successful sign-in returns to a validated target or the Project directory.
### Project directory
The Project directory is the signed-in landing surface. It presents Projects the user may open, Project creation when entitled, ownership/organization labels, recent activity metadata, and explicit actions. Selecting a Project navigates; it does not permanently mutate session scope.
### User libraries
Context, Templates, and Personality/Agents are durable user-level resources. Their list/detail screens work before any Project is open. “Bring into Project” prompts for or receives an explicit target Project and materializes an independent Project copy according to the relevant model authority.
### Settings
User settings are routes, not workbench-only dialogs. Project settings are explicit `/projects/:projectId/settings` control-plane routes. A quick workbench menu may navigate or open a small focused dialog, but it cannot make settings dependent on an already-open resource runtime. Workspace tabs, panel state, and viewports are not settings.
### Organization administration
Organization administration is a distinct control-plane console, not a second editor shell. It may reuse Table, Form, Menu, Modal, and Drawer components. It does not mount Context/Inspector/Quarterback or inspect Project content.
### Workbench
The Project workbench is browser-interactive and can remain client-rendered where editor engines require DOM. Its route loader still performs deterministic session/admission sequencing. It must not depend on click retries after hydration.
## Modals versus routes
Use a route when the workflow has durable navigation value, substantial information architecture, permission-specific recovery, or must work outside a Project shell. Use an overlay when the workflow is short, contextual, interruptible, and returns to the same surface.
<table header-row="true">
<tr>
<td>Route</td>
<td>Overlay</td>
</tr>
<tr>
<td>account settings</td>
<td>confirm destructive action</td>
</tr>
<tr>
<td>organization administration</td>
<td>create Project</td>
</tr>
<tr>
<td>user library list/detail</td>
<td>choose target Project</td>
</tr>
<tr>
<td>Project settings/access page</td>
<td>quick resource rename/settings</td>
</tr>
<tr>
<td>workbench</td>
<td>share picker, import/export options</td>
</tr>
<tr>
<td>Personality detail</td>
<td>focused filter/editor utility</td>
</tr>
</table>
A route may contain overlays. Closing an overlay returns focus; leaving a route follows navigation focus policy.
## Current Alpha migration notes
- Replace `POST /session/project` and `withProject()` ambient retargeting with clients that accept explicit `ProjectScope`.
- Move User Settings and Organizations from Project-shell-only dialogs to signed-in control-plane routes.
- Give all `/library/*` routes one authenticated layout/loader policy; remove hydration click retries.
- Keep `/projects/:id` as the workbench route while removing its mount-time `openProject(id)` dependency.
- Add Organization administration and durable library-detail routes as Omega contracts land.
- Gate `/components` outside production or behind an internal flag.
## Sources
- <mention-page url="https://app.notion.com/p/3adb6410e502818fb987d5f5004117e3"/>
- <mention-page url="https://app.notion.com/p/3acb6410e5028122ab96eed1434bb897"/>
- <mention-page url="https://app.notion.com/p/3acb6410e502815c8782cb126c93b787"/>
- <mention-page url="https://app.notion.com/p/3acb6410e5028106b617d05f162b5ddf"/>
- <mention-page url="https://app.notion.com/p/3acb6410e502814e928ae1f10eac6f75"/>
- <mention-page url="https://app.notion.com/p/3acb6410e50281bf8987c9a87e6687dd"/>
- [Current Alpha route tree](https://github.com/gccurtis/taurus-alpha/tree/d2b1bdcd02307f29ab4a895232cbf857d8157a56/src/routes)

