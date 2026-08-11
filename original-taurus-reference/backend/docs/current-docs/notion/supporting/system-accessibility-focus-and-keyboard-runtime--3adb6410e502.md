---
title: "System — Accessibility, Focus & Keyboard Runtime"
notion_page_id: "3adb6410e50281a8b8edef96653bee7d"
notion_url: "https://app.notion.com/3adb6410e50281a8b8edef96653bee7d"
project: "Taurus Yesod"
role: "Supporting"
format: "Spec"
created: "2026-07-30 05:31:05Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# System — Accessibility, Focus & Keyboard Runtime

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

> **Release floor:** Taurus Alpha meets WCAG 2.2 AA and the current Yesod accessibility/legibility authority. Accessibility is distributed across runtime, components, feature controllers, editor adapters, and tests; it is never delegated to “the component library” alone.
## Responsibilities by layer
<table header-row="true">
<tr>
<td>Layer</td>
<td>Accessibility responsibility</td>
</tr>
<tr>
<td>Route runtime</td>
<td>document title, route heading, loading/forbidden/error semantics, route-change focus and announcements</td>
</tr>
<tr>
<td>Overlay runtime</td>
<td>initial focus, trap/containment, inert background, Escape arbitration, close reason, focus restoration</td>
</tr>
<tr>
<td>Shell runtime</td>
<td>landmark structure, panel/tab keyboard routing, active surface label, resize alternatives</td>
</tr>
<tr>
<td>Interaction runtime</td>
<td>logical focus target, selection announcements, reveal behavior, non-drag actions</td>
</tr>
<tr>
<td>Components</td>
<td>native semantics, accessible name/description/state, roving focus where pattern requires it</td>
</tr>
<tr>
<td>Resource adapter</td>
<td>editor/canvas/grid keyboard model, selection mapping, IME, read-only mode, screen-reader surface</td>
</tr>
<tr>
<td>Feature controller</td>
<td>meaningful status/error messages and focus after completion/failure</td>
</tr>
<tr>
<td>Visual system</td>
<td>contrast, focus visibility, zoom/reflow, reduced motion, forced colors</td>
</tr>
<tr>
<td>Test system</td>
<td>automated and manual conformance evidence</td>
</tr>
</table>
## Focus runtime
Focus is modeled as an effect with an owner and restoration path.
```typescript
interface FocusTarget {
  scope: "route" | "shell" | "stage" | "panel" | "overlay";
  id: string;
  fallback?: string[];
}

interface FocusRuntime {
  capture(reason: string): FocusSnapshot;
  move(target: FocusTarget, options?: { announce?: string }): boolean;
  restore(snapshot: FocusSnapshot): boolean;
  register(target: FocusTarget, element: HTMLElement): () => void;
}
```
Components may call element focus internally to implement a pattern, but cross-region focus goes through the runtime so a disappearing selection, closed tab, or unmounted stage has a deterministic fallback.
## Global focus order and ownership
- The skip link reaches the active work surface.
- Top bar and tab strip precede the four work regions in DOM order.
- Context, work surface, Inspector, and Quarterback are named landmarks/regions.
- Collapsed rails remain keyboard reachable without flooding the tab order.
- Opening an overlay transfers focus into it.
- Closing restores the invoking control when it still exists; otherwise the runtime uses the nearest stable fallback.
- Activating a Workspace tab by keyboard moves focus according to the tab pattern; pointer activation does not cause an unexpected jump.
- Closing an active tab focuses the newly active tab or stable tab-strip fallback.
- Closing Inspector never destroys editor selection and returns focus to the invoking control or editor host.
- Route navigation focuses the route’s primary heading or declared destination and announces the new screen.
## Keyboard priority
Keyboard handling is scoped, not global.
1. topmost modal overlay;
2. active non-modal popup/menu/combobox;
3. focused editor/grid/canvas adapter;
4. focused shell pattern such as tab strip or rail;
5. declared application shortcuts.
A lower scope never consumes a key already handled by a higher scope. Text input, IME composition, and assistive-technology commands are protected. Application shortcuts use a registry with discoverable labels, enablement, and collision checks.
## Pattern contracts
Use the WAI-ARIA Authoring Practices as implementation guidance while preferring native HTML.
- **Dialog:** labelled, described when useful, focus contained, Escape policy explicit, destructive initial focus chosen safely.
- **Tabs:** roving tab stop, arrow navigation, correct automatic/manual activation policy, associated tabpanel.
- **Menu/menu button:** arrow, Home/End, Escape, typeahead where appropriate; returns focus.
- **Combobox:** input/listbox state, active descendant or managed focus, clear filtering and commit semantics.
- **Tooltip:** supplementary only; never the sole accessible name or required information.
- **Tree/listbox/grid:** used only when its full keyboard/selection model is implemented.
- **Separator/resize handle:** focusable when interactive, exposes orientation/value, supports keyboard increments and reset.
## Selection and Inspector announcements
Visual selection and DOM focus are related but distinct. Selecting an object does not always move DOM focus. The active Resource adapter publishes a concise accessible selection description, for example “Chart selected, Revenue by month” or “Three paragraphs selected.” The Inspector heading reflects that target. Repeated pointer selection is not announced excessively; keyboard selection and major target changes are.
Multi-selection exposes count and type. Mixed selections state which properties are common, mixed, unavailable, or read-only. Errors point to the relevant control and provide a summary when a workflow spans many fields.
## Direct manipulation and drag
Every drag operation has a single-pointer and non-drag alternative. Examples:
- tab reorder: keyboard move commands and item menu;
- slide/object reorder: move forward/backward and position commands;
- panel resize: focusable separator with arrow increments and reset;
- resource bulk action: checkbox/multi-select controls;
- canvas positioning: keyboard nudge plus numeric Inspector controls.
A drag preview is not the only indication of source, target, validity, or result. Drop targets meet target-size and contrast requirements.
## Status and live regions
Use separate channels:
- **polite status:** saved, retrying, search result count, background job progress;
- **assertive alert:** operation failed when immediate attention is required, access revoked, destructive refusal;
- **static inline error:** field validation and persistent problems;
- **progress:** determinate or indeterminate job/loading semantics.
Do not announce every keystroke or optimistic update. Debounce repetitive save/status messages and announce the final meaningful transition.
## Visual and motion requirements
The visual authority governs exact tokens. The runtime enforces:
- focus-visible is distinct in every theme and forced colors;
- meaning is never color-only;
- content reflows at 200% zoom without losing operation;
- essential controls meet WCAG target-size rules or valid exceptions;
- reduced motion disables nonessential transitions and changes JS timing behavior;
- animations do not delay focus or state acknowledgement;
- loading skeletons expose appropriate semantic status rather than dozens of hidden pseudo-elements;
- touch, pointer, keyboard, and screen-reader routes reach the same operations.
## Editor adapters
Document, Spreadsheet, Slides, and Chat require resource-specific accessibility contracts.
### Document/ProseMirror
Use the engine’s content-editable semantics while supplying document title/status, toolbar relationships, selection mapping, comment/reference announcements, read-only behavior, and predictable shortcut handling. Remote/reconciliation transactions do not steal focus or reset selection unless the selected target ceased to exist.
### Spreadsheet
Provide grid navigation, row/column/cell coordinates, formula/value distinction, edit versus navigation modes, multi-range selection, error/value announcements, and non-pointer range operations. Large grids need virtualized accessibility that preserves logical row/column identity.
### Slides
Canvas rendering requires an accessible object/slide tree or equivalent DOM control surface. Users can select, reorder, position, resize, edit, and inspect objects without pointer-only interaction. Numeric Inspector controls are first-class alternatives.
### Chat
Turns and branches have headings/labels, streaming output has bounded announcements, stop/retry actions are reachable, and branch navigation is explicit. Generated content does not continuously seize the live region.
## Required test stack
### Static and unit
- semantic linting where reliable;
- pure tests for focus target resolution and keyboard command maps;
- no duplicate IDs and stable ARIA relationships.
### Component DOM tests
Add a browser-like DOM test environment and accessibility assertions for exported interactive components. Cover Tab/Shift+Tab, arrow navigation, Escape, Enter/Space, focus containment/restoration, disabled/read-only states, accessible names and descriptions. An open-source axe integration may supplement, not replace, behavior tests.
### End to end
Playwright covers:
- keyboard-only critical journeys;
- sign-in and route focus;
- Project directory and Project admission;
- tabs, Context, Inspector, Quarterback;
- every modal/destructive workflow;
- at least one complete operation per Resource editor;
- zoom/reflow, reduced motion, high contrast/forced colors where browser support permits;
- reconnect, refusal, and conflict focus behavior.
Manual screen-reader passes are required for new complex widgets/editors and before a major release.
## Current Alpha gaps to close
- Modal and Drawer lack initial focus, containment/inert background, and focus restoration.
- Menu and custom TabStrip context menu lack complete arrow/Home/End/typeahead behavior.
- SidePanel’s interactive separator is pointer-only.
- component tests run in a Node environment with no DOM accessibility harness.
- E2E relies on Chromium only and has no automated keyboard/axe conformance suite.
- long feature components need clearer heading/region/focus ownership.
- library hydration races are retried in tests instead of prevented by route architecture.
## Completion gate
No interactive component or feature is complete until its accessible name, role, state, keyboard path, focus entry/exit, announcement policy, reduced-motion behavior, error recovery, and non-pointer equivalent are specified and tested.
## Sources
- <mention-page url="https://app.notion.com/p/392b6410e50281de8f06c206383e8d2f"/>
- <mention-page url="https://app.notion.com/p/e12b6939dbc444698aca18d4162bab10"/>
- <mention-page url="https://app.notion.com/p/3adb6410e50281aeae8ec87167771288"/>
- [Web Content Accessibility Guidelines 2.2](https://www.w3.org/TR/WCAG22/)
- [WAI-ARIA Authoring Practices patterns](https://www.w3.org/WAI/ARIA/apg/patterns/)
- [WAI-ARIA combobox pattern](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/)
- [Current Alpha accessibility/style guidance](https://github.com/gccurtis/taurus-alpha/blob/d2b1bdcd02307f29ab4a895232cbf857d8157a56/docs/style/accessibility-usability.md)

