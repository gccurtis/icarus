---
title: "System — Frontend Component Library & Composition Contract"
notion_page_id: "3adb6410e50281aeae8ec87167771288"
notion_url: "https://app.notion.com/3adb6410e50281aeae8ec87167771288"
project: "Taurus Yesod"
role: "Supporting"
format: "Spec"
created: "2026-07-30 05:31:05Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# System — Frontend Component Library & Composition Contract

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

> **Decision:** The component library is a presentation system. It owns semantics, accessible behavior, visual states, and composable layout contracts. It receives data and callbacks; it does not fetch, authorize, persist, or mutate domain stores.
## Boundary
```plain text
feature/runtime view model
  → component props and snippets
    → semantic DOM + centralized tokens
      → semantic component event
        → feature controller
```
Components may own presentation-local state such as disclosure, roving focus, measured placement, and pointer capture. Compound components may use Svelte context to coordinate descendants. They may not depend on `$data`, `$systems`, Project runtime singletons, resource session stores, or feature-specific API types.
## Component tiers
<table header-row="true">
<tr>
<td>Tier</td>
<td>Examples</td>
<td>Allowed state</td>
</tr>
<tr>
<td>Primitive</td>
<td>Button, IconButton, Input, Checkbox, Divider, Spinner</td>
<td>interaction/visual state only</td>
</tr>
<tr>
<td>Accessible behavior primitive</td>
<td>Dialog shell, Menu, Tabs, Combobox, Tooltip, Popover</td>
<td>focus, keyboard, disclosure, placement</td>
</tr>
<tr>
<td>Compound pattern</td>
<td>Field, DataTable, Pagination, SearchField, Tree, SplitPanel</td>
<td>local composition state; controlled domain value</td>
</tr>
<tr>
<td>Taurus shell component</td>
<td>SidePanel, Rail, PanelResults, TabStrip presentation, Status region</td>
<td>controlled shell mechanics</td>
</tr>
<tr>
<td>Feature view component</td>
<td>Project list, Member table, Document details controls</td>
<td>drafts and controller-owned view model</td>
</tr>
<tr>
<td>Engine host</td>
<td>ProseMirror host, grid host, canvas host</td>
<td>DOM engine attachment through adapter</td>
</tr>
<tr>
<td>Route/screen composition</td>
<td>Project directory, admin console, workbench</td>
<td>runtime acquisition and feature composition</td>
</tr>
</table>
Feature views are not exported as generic primitives merely because they are reusable within one capability.
## Existing Alpha inventory
The current library already provides a substantial base.
<table header-row="true">
<tr>
<td>Family</td>
<td>Current components</td>
<td>Target work</td>
</tr>
<tr>
<td>Actions/status</td>
<td>Button, IconButton, Badge, Chip, StatusDot, StatePill, Kbd, Spinner, Skeleton</td>
<td>retain; complete state and forced-color tests</td>
</tr>
<tr>
<td>Forms</td>
<td>Label, Field, Input, Textarea, Select, Combobox, NumberField, Checkbox, Switch, RadioGroup, Slider, SegmentedControl</td>
<td>retain; normalize descriptions/errors and keyboard contracts</td>
</tr>
<tr>
<td>Data/display</td>
<td>Card, Stat, Progress, Table, KeyValue, Code, Divider</td>
<td>retain; add scalable DataTable/Tree/List patterns as product use requires</td>
</tr>
<tr>
<td>Disclosure/navigation</td>
<td>Tabs, Accordion, Breadcrumbs, Pagination, Stepper</td>
<td>retain; harden roving focus and activation semantics</td>
</tr>
<tr>
<td>Overlay/feedback</td>
<td>Alert, Banner, Tooltip, Modal, Drawer, Popover, Menu, Toaster/toast</td>
<td>retain visual APIs; move focus/stack/placement to overlay runtime</td>
</tr>
<tr>
<td>Taurus surfaces</td>
<td>TopBar, Toolbar, InspectorSection, PanelResults, PromptBlock, QuarterbackBar, EmptyState, IdentityHoverCard, MockBadge</td>
<td>retain, clarify controlled contracts</td>
</tr>
<tr>
<td>Shell mechanics</td>
<td>SidePanel, rail, resize handle, TabStrip, status region</td>
<td>promote shared mechanics only; remove capability reads</td>
</tr>
<tr>
<td>Missing common patterns</td>
<td>SearchField, VirtualList adapter, Tree, CommandList, ConfirmDialog model, FormActions, InlineEdit, SplitPane</td>
<td>build only from demonstrated screen needs</td>
</tr>
</table>
The live `/components` catalog remains the visual and interaction fixture. It must show default, hover where practical, focus-visible, selected, disabled, loading, invalid, read-only, empty, error, offline, and long-content states.
## Standard component contract
```typescript
type ComponentTone = "neutral" | "accent" | "success" | "warning" | "danger";

interface ControlledFieldProps<T> {
  value: T;
  label: string;
  description?: string;
  error?: string;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  oninput?: (value: T) => void;
  oncommit?: () => void;
}

interface AsyncActionProps {
  pending?: boolean;
  disabled?: boolean;
  fault?: PresentableFault;
  oninvoke: () => void | Promise<void>;
}
```
Svelte components use typed props, snippets for content composition, semantic callbacks, and stable IDs. `bind:` is appropriate for presentation state or an explicitly controlled value; it does not permit a child to mutate a capability store.
## Variants and class extension
Components expose named variants for semantic behavior. A `class` passthrough remains available for external layout and deliberate extension, merged last, but it is not the normal way to redefine internal color, focus, disabled, or sizing semantics. Feature code uses tokens and variants instead of copying long state-dependent Tailwind strings.
Repeated feature combinations graduate into a compound component when they have shared semantics or accessibility—not merely shared appearance.
## Styling boundary
The existing Taurus visual documents and `src/app.css` remain authoritative. This page does not restate colors, typography, shadows, radii, or motion values.
The technical contract is:
- Foundation → Semantic → Component → Resource → Instance tokens;
- components consume semantic/component/resource tokens, never raw hex;
- shell geometry and JavaScript motion values are generated from or imported from one typed token source;
- themes alter tokens, not component logic;
- resource signatures may specialize approved resource tokens;
- reduced motion and forced-color adaptations are centralized;
- feature code cannot create a second token namespace.
This specifically removes the current divergence between CSS panel geometry and TypeScript Workspace constants.
## State and async presentation
Components do not infer loading from `undefined`. View models provide explicit states:
```typescript
type Loadable<T> =
  | { state: "idle" }
  | { state: "loading"; previous?: T }
  | { state: "ready"; value: T; stale?: boolean }
  | { state: "empty" }
  | { state: "offline"; previous?: T }
  | { state: "error"; fault: PresentableFault; previous?: T };
```
A component receives `Loadable<T>` or a narrower view model and renders the declared state. Retry is a semantic callback.
## Composition rules
1. Components do not call APIs or capability actions.
2. Components do not subscribe to global feature stores.
3. Compound component context is private to its subtree.
4. Feature composition injects view models and controllers.
5. One component owns each interactive DOM role; wrappers do not duplicate button/dialog/tab semantics.
6. Interactive state is controllable where the parent must coordinate it.
7. IDs used for ARIA relationships are stable across hydration.
8. Components forward necessary DOM attributes and references without exposing internals as the primary API.
9. Global listeners are registered through a lifecycle utility and always released.
10. Any component with pointer-only behavior is incomplete.
## Large feature-component extraction rule
A component should be split when it combines three or more of:
- transport or store mutation;
- workflow state machine;
- complex derived data;
- large semantic markup;
- engine/DOM lifecycle;
- multiple independent dialogs;
- cross-surface coordination.
The target split is usually `model.ts`, `controller.ts`, pure selectors, focused view components, and a small composition component. This applies immediately to the current large DocumentStage, ResourceTable, HistoryPanel, NameManagerPanel, OrganizationsDialog, ActivityFeed, ProjectSharing, and AgentLens surfaces.
## Packaging and dependencies
Alpha remains the component package; a separate published package is not required for V1. Export public primitives through `src/lib/components/index.ts`. Keep internal subcomponents private unless a second real consumer establishes a stable contract.
Any new dependency must be actively maintained, free/open-source under an acceptable permissive license, compatible with Svelte 5 and browser support, tree-shakeable where relevant, and security-reviewed. This architecture does not preselect a headless UI, virtualizer, drag library, or schema validator.
## Verification
Each exported component has:
- unit tests for prop/state transitions;
- DOM tests for role/name/state and keyboard behavior;
- focus-visible and focus-restoration tests where applicable;
- reduced-motion and forced-color coverage for relevant behavior;
- component-catalog fixtures;
- at least one real feature integration before its API is considered stable.
Lint/import rules prohibit `src/lib/components/**` from importing `$data`, `$systems`, or `src/lib/features`.
## Sources
- <mention-page url="https://app.notion.com/p/3adb6410e502818fb987d5f5004117e3"/>
- <mention-page url="https://app.notion.com/p/392b6410e50281f1a374fa89a941626a"/>
- <mention-page url="https://app.notion.com/p/39ab6410e50281798739fa3a9e8931ac"/>
- <mention-page url="https://app.notion.com/p/e12b6939dbc444698aca18d4162bab10"/>
- [Current Alpha component catalog](https://github.com/gccurtis/taurus-alpha/blob/d2b1bdcd02307f29ab4a895232cbf857d8157a56/src/lib/components/README.md)
- [Svelte bindable props](https://svelte.dev/docs/svelte/%24bindable)
- [Svelte context](https://svelte.dev/docs/svelte/context)

