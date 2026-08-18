# Workspace Components

Lives at `components/components.md`.

The screen roots. One per `ScreenKind`, because
[`workspace.svelte`](../workspace.svelte) holds a `Record<ScreenKind, …>` and a
partial map would let a screen arrive with nothing to render it.

| File | Screen | Built |
| --- | --- | --- |
| [`project-overview.svelte`](project-overview.svelte) | `project-overview` | fixture |
| [`document.svelte`](document.svelte) | `document` | fixture |
| [`new-tab.svelte`](new-tab.svelte) | `new-tab` | fixture |
| [`research.svelte`](research.svelte) | `research` | placeholder |
| [`analysis.svelte`](analysis.svelte) | `analysis` | placeholder |
| [`context.svelte`](context.svelte) | `context` | placeholder |
| [`templates.svelte`](templates.svelte) | `templates` | placeholder |
| [`personas.svelte`](personas.svelte) | `personas` | placeholder |
| [`automations.svelte`](automations.svelte) | `automations` | placeholder |
| [`slides.svelte`](slides.svelte) | `slides` | placeholder |
| [`spreadsheet.svelte`](spreadsheet.svelte) | `spreadsheet` | placeholder |
| [`placeholder.svelte`](placeholder.svelte) | — | the shared unbuilt body |

## Every screen has the same signature

`{ tab: Tab }`, and nothing else. That is what lets the workspace hold one total
map, and it is the reason a singleton screen takes a prop it does not read.

A screen reaches everything else from the tab: typed working state through
`tab.viewState`, an editable body through `workbench.runtimeFor(tab.id)`, and
anything stored through an ordinary `useQuery` — which is already a live
subscription and should not be wrapped.

## Three fixtures and eight placeholders

**A placeholder is deliberately visible as unbuilt.** Inventing a plausible
surface for a screen whose capability does not exist produces a demo nobody can
tell from the real thing, and the shell around it — the tab, the rail, the
inspector, the frame — is real either way, so anything about the shell can be
exercised through one of these.

The three fixtures each prove one path end to end:

- **`project-overview`** is the only caller of `open()`. Pressing an entry mints
  a tab or activates the one already holding that resource.
- **`document`** is the only caller of `inspect()`. Pressing inside a block
  records an anchor and inspects the caret; dragging records the offsets in view
  state and inspects the selection — so the inspector's whole path, from a
  gesture through the workbench to a rendered panel, works without a document
  capability existing. Nothing carries text into the inspection: the key is a
  label and the detail lives in view state.
- **`new-tab`** is the only caller of `resolveLauncher()`. Picking an entry turns
  *this* tab into what it created, keeping its id and its slot.

## Remounting

The workspace keys on the active tab, so every one of these remounts on a tab
switch. Nothing here may hold state that has to survive that — it goes in
`viewState`, or behind the runtime, both of which outlive the component.
