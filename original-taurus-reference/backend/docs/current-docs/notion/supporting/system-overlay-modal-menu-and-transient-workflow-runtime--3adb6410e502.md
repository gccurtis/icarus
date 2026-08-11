---
title: "System — Overlay, Modal, Menu & Transient Workflow Runtime"
notion_page_id: "3adb6410e502810491c7eda475987775"
notion_url: "https://app.notion.com/3adb6410e502810491c7eda475987775"
project: "Taurus Yesod"
role: "Supporting"
format: "Spec"
created: "2026-07-30 05:31:05Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# System — Overlay, Modal, Menu & Transient Workflow Runtime

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

> **Decision:** Taurus Alpha uses one overlay host and focus/stack runtime for blocking and application-level transient workflows. Feature controllers request typed overlays and receive typed results; overlays do not perform domain mutations themselves.
## Overlay classes
<table header-row="true">
<tr>
<td>Class</td>
<td>Examples</td>
<td>Ownership</td>
</tr>
<tr>
<td>Blocking dialog</td>
<td>destructive confirmation, create Project, choose target Project</td>
<td>global overlay runtime</td>
</tr>
<tr>
<td>Drawer/sheet</td>
<td>dense contextual workflow that may remain beside content</td>
<td>global overlay runtime</td>
</tr>
<tr>
<td>Command surface</td>
<td>command palette, resource picker</td>
<td>global overlay runtime</td>
</tr>
<tr>
<td>Anchored popup</td>
<td>menu, combobox list, popover</td>
<td>local controller using shared layer/focus primitives</td>
</tr>
<tr>
<td>Tooltip</td>
<td>supplementary label/help</td>
<td>local component using shared primitive</td>
</tr>
<tr>
<td>Notification</td>
<td>toast/status item</td>
<td>global notification runtime</td>
</tr>
<tr>
<td>Route-backed workflow</td>
<td>account settings, organization admin, large Project settings</td>
<td>router, not overlay runtime</td>
</tr>
</table>
Local anchored surfaces still register with the shared layer manager for z-order and Escape arbitration. A tooltip does not become a global promise-based workflow.
## Runtime contract
```typescript
interface OverlayMap {
  "confirm": {
    args: ConfirmationModel;
    result: { confirmed: boolean };
  };
  "project.create": {
    args: CreateProjectDraftSeed;
    result: { projectId: string } | null;
  };
  "project.choose-target": {
    args: ChooseProjectModel;
    result: { projectId: string } | null;
  };
  "resource.settings": {
    args: { projectId: string; resourceId: string };
    result: ResourceSettingsResult | null;
  };
}

interface OverlayRuntime {
  open<K extends keyof OverlayMap>(
    kind: K,
    args: OverlayMap[K]["args"],
    options?: OverlayOptions
  ): Promise<OverlayMap[K]["result"]>;

  dismiss(id: string, reason: DismissReason): void;
  readonly stack: Readable<readonly OverlayEntry[]>;
}

interface OverlayOptions {
  returnFocusTo?: FocusTarget;
  dismissOnEscape?: boolean;
  dismissOnBackdrop?: boolean;
  routeKey?: string;
}
```
The registry is statically assembled. It is not a stringly typed service locator available to arbitrary code.
## Dialog lifecycle
1. Controller captures the invoking Focus target.
2. Overlay runtime appends an entry and portals it to the application host.
3. Background application regions become inert for a modal entry.
4. Scroll lock is reference-counted.
5. The dialog computes safe initial focus after content mounts.
6. Tab/Shift+Tab remain in the topmost modal scope.
7. Escape is handled only by the topmost eligible entry.
8. Backdrop dismissal occurs only when pointer down and up both belong to the backdrop and policy permits it.
9. Pending destructive submission disables duplicate confirmation but leaves cancellation policy explicit.
10. Completion resolves the typed promise, removes the entry, restores inert/scroll state, and restores focus to the captured target or a stable fallback.
Nested modal dialogs are discouraged. A follow-up choice should usually replace the current dialog model or render as one multi-step workflow. If nesting is unavoidable, only the top entry is interactive and each entry restores to its parent before final trigger restoration.
## Modal semantics
Every modal definition specifies:
- title and optional description;
- semantic role and accessible relationships;
- initial focus rule;
- trigger/fallback focus target;
- Escape and backdrop policies;
- cancellability while pending;
- size/overflow behavior;
- submit, cancel, and destructive labels;
- loading, validation, refusal, conflict, and offline states;
- whether state survives accidental close;
- analytics/telemetry ID without sensitive content;
- owner feature and backend command;
- mobile/narrow-screen presentation;
- route-backed alternative when the workflow grows.
Destructive dialogs focus the safest useful control, not automatically the destructive button.
## Initial V1 workflow inventory
This inventory governs disposition. Feature pages may add entries only by registering the same fields and linking them here.
### Authentication and control plane
<table header-row="true">
<tr>
<td>Workflow</td>
<td>Target surface</td>
</tr>
<tr>
<td>expired session</td>
<td>sign-in route state, not a modal</td>
</tr>
<tr>
<td>create Project</td>
<td>dialog from Project directory</td>
</tr>
<tr>
<td>choose target Project for library asset/task</td>
<td>searchable dialog/command surface</td>
</tr>
<tr>
<td>leave Project</td>
<td>confirmation dialog</td>
</tr>
<tr>
<td>delete Project</td>
<td>confirmation reached from Project settings route</td>
</tr>
<tr>
<td>quick Project share/invite</td>
<td>dialog or drawer; full access management remains Project settings</td>
</tr>
<tr>
<td>user account/settings</td>
<td>route</td>
</tr>
<tr>
<td>organization tree/member/project/license administration</td>
<td>route</td>
</tr>
<tr>
<td>remove organization member/change consequential role</td>
<td>confirmation within admin route</td>
</tr>
<tr>
<td>sign out with risky unsent local state</td>
<td>confirmation only when such state truly exists</td>
</tr>
</table>
### Project shell and resources
<table header-row="true">
<tr>
<td>Workflow</td>
<td>Target surface</td>
</tr>
<tr>
<td>create resource</td>
<td>New Tab stage; focused subtype options may use popover/dialog</td>
</tr>
<tr>
<td>import/upload</td>
<td>dialog/drop workflow with progress and errors</td>
</tr>
<tr>
<td>resource settings/rename</td>
<td>inline edit or focused dialog; complex settings route/drawer if needed</td>
</tr>
<tr>
<td>share resource</td>
<td>dialog/drawer using shared sharing composition</td>
</tr>
<tr>
<td>delete resource</td>
<td>confirmation dialog</td>
</tr>
<tr>
<td>export resource</td>
<td>dialog only when format/options are required; direct action otherwise</td>
</tr>
<tr>
<td>move/duplicate resource</td>
<td>choose-target dialog when multiple destinations exist</td>
</tr>
<tr>
<td>Activity filters</td>
<td>popover or drawer depending density</td>
</tr>
<tr>
<td>bulk destructive resource action</td>
<td>confirmation summarizing exact scope</td>
</tr>
<tr>
<td>unsupported file/resource</td>
<td>nonblocking stage state; no empty modal</td>
</tr>
</table>
### Resource editors
<table header-row="true">
<tr>
<td>Workflow</td>
<td>Target surface</td>
</tr>
<tr>
<td>template chooser</td>
<td>Context lens or picker dialog according to resource authority</td>
</tr>
<tr>
<td>history restore</td>
<td>history surface plus confirmation</td>
</tr>
<tr>
<td>Name Manager</td>
<td>Context lens/Inspector workflow; modal only for focused create/edit if spatially safer</td>
</tr>
<tr>
<td>comments/tasks</td>
<td>Context/Inspector; detail drawer only when required</td>
</tr>
<tr>
<td>references/resource picker</td>
<td>searchable command surface/dialog</td>
</tr>
<tr>
<td>spreadsheet import/data options</td>
<td>dialog with validation preview</td>
</tr>
<tr>
<td>slide layout/template selection</td>
<td>Context lens or anchored picker</td>
</tr>
<tr>
<td>editor find/search</td>
<td>Context lens or in-surface command, not modal</td>
</tr>
<tr>
<td>conflict resolution</td>
<td>resource-owned recovery surface; modal only for a necessary mutually exclusive decision</td>
</tr>
</table>
### AI and Quarterback
<table header-row="true">
<tr>
<td>Workflow</td>
<td>Target surface</td>
</tr>
<tr>
<td>compose prompt</td>
<td>Quarterback dock/AI Inspector</td>
</tr>
<tr>
<td>choose Personality/Agent</td>
<td>anchored picker or command surface</td>
</tr>
<tr>
<td>choose/add context</td>
<td>searchable picker</td>
</tr>
<tr>
<td>stop/cancel job</td>
<td>inline action; confirm only if consequences warrant it</td>
</tr>
<tr>
<td>discard substantial prompt draft</td>
<td>confirmation only if the draft cannot be recovered</td>
</tr>
<tr>
<td>task detail/progress</td>
<td>AI Inspector or task surface</td>
</tr>
<tr>
<td>permission/entitlement refusal</td>
<td>inline persistent fault with navigation action; toast is supplementary</td>
</tr>
</table>
## Menu, popover, and combobox behavior
Menus use a menu-button model with arrow navigation, Home/End, Escape, typeahead where useful, disabled-item semantics, and focus return. Context menus always have a keyboard/menu-button alternative.
Popovers declare whether they are dismissible, interactive, modal-like, or informational. They are positioned relative to an anchor with viewport collision handling and update on resize/scroll. Losing the anchor closes safely.
Comboboxes own the complete input/listbox contract and do not compose a generic Input plus Menu without the required active-option semantics.
Tooltips contain supplementary information only. They open from hover and focus, close on Escape, do not trap focus, and are not the sole source of a control’s name.
## Async operations
The overlay returns the user’s decision or validated draft. The controller performs the command. For workflows whose form submission occurs inside the overlay, the controller is injected as a narrow callback and exposes explicit pending/fault state; the overlay component still does not import the client.
A modal cannot close on an optimistic “success” if the product requires confirmation. Conversely, a backend mutation that can safely continue after close belongs to a background runtime and reports status elsewhere.
## Notifications
Toasts are acknowledgements, not durable error storage. A notification has tone, concise message, optional action, dedupe key, lifetime, and announcement policy. Persistent or actionable failures remain in the owning screen/panel. Retry is never available only in a disappearing toast.
## Current Alpha migration
Current Modal/Drawer/Menu/Popover components retain their visual APIs but move behavior under shared primitives. Replace every component-local window Escape listener with stack arbitration. Add portal placement, initial focus, focus containment, inert background, reference-counted scroll lock, and focus restoration.
Migrate current workflows in bounded groups:
1. Project creation/sharing/settings and destructive confirmation.
2. Resource settings/sharing/import/export.
3. Activity filters and pickers.
4. Document history/tasks/Name Manager/templates.
5. Library and AI selectors.
6. User Settings and Organizations leave the workbench modal system and become routes.
## Verification
Contract tests cover stack order, nested behavior, Escape, backdrop pointer sequence, focus trap/restore, removed trigger fallback, scroll lock, inert state, async pending, route navigation during open overlay, Project switch, browser history, reduced motion, and screen-reader labels. Every registered dialog is exercised by keyboard-only Playwright coverage.
## Sources
- <mention-page url="https://app.notion.com/p/3adb6410e50281a8b8edef96653bee7d"/>
- <mention-page url="https://app.notion.com/p/3adb6410e5028163bf85c5fe95a8a163"/>
- <mention-page url="https://app.notion.com/p/e12b6939dbc444698aca18d4162bab10"/>
- [WAI-ARIA dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)
- [WAI-ARIA menu and menu-button patterns](https://www.w3.org/WAI/ARIA/apg/patterns/menubar/)
- [Current Alpha Modal](https://github.com/gccurtis/taurus-alpha/blob/d2b1bdcd02307f29ab4a895232cbf857d8157a56/src/lib/components/Modal.svelte)

