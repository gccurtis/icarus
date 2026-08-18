# Workspace

Lives at `src/lib/views/workspace/workspace.md`. Trees live in the concern
documents linked below.

## Purpose

The work surface: whatever the active tab holds, rendered on the generous plane
at the centre of the frame.

It fills from the workbench rather than from the route, and that is what makes
tabs possible at all. Switching tabs is not a navigation, so nothing about what
is open is expressible as a URL segment — a centre that took route content could
not follow a tab.

## Boundary

This view owns:

- resolving a screen kind to a component;
- the rule that two tabs are two mounts, even when they hold the same kind.

It does not own:

- which tab is active, or what it holds. Both are model state.
- display copy for a screen kind. The tab bar owns the label and icon, because
  that is the surface that displays them.
- the scroll. The frame's centre owns it, so a resource cannot take the page
  with it.

## Public Contract

- **Entry:** [`workspace.svelte`](workspace.svelte)
- **Types:** `None`

| Kind | Name | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| — | — | — | — | Nothing. It reads the workbench directly. |

## Dependencies

### Client models

| Door | Usage |
| --- | --- |
| `$model/client` | `workbench.active.resource`, `activeId` |

### Capabilities

| Browser door | Usage |
| --- | --- |
| `None` | — |

### Composed views

| View | Root imported | Usage |
| --- | --- | --- |
| `None` | — | — |

A resource that grows past a component becomes a sibling view and is imported
through its root. None has yet.

### Presentation

| Dependency | Usage |
| --- | --- |
| Token domains: color, spacing, typography | Inherited by what it renders; this view declares none of its own |

## Directory Documents

| Concern | Document | What it owns |
| --- | --- | --- |
| Components | [components.md](components/components.md) | The resource components and the key map |

## Rendered States

| State | Trigger | Visible result | Available recovery |
| --- | --- | --- | --- |
| Initial | Always | The active tab's resource | — |
| Switched | A different tab became active | The new tab's resource, freshly mounted | — |
| Loading | `None` | — | — |
| Empty | `None` | — | — |
| Stale | `None` | — | — |
| Failure | `None` | — | — |
| Denied | `None` | — | — |

No empty state, and no unknown-kind state. `activeId` always names a real tab —
a permanent tab cannot be closed — and restoration drops a stored kind the
current build no longer recognises, so every kind reaching here maps.

## Accessibility

- **Landmark and accessible name:** none of its own. The frame's centre is the
  `main` landmark and this view renders inside it.
- **Initial focus:** none taken.
- **Keyboard model:** whatever the resource brings.
- **Announcements:** `None` yet. A tab change replaces this whole subtree
  silently; announcing it is a decision for the first resource that takes focus.
- **Focus restoration:** `None` yet. See scroll restoration below — both belong
  to the same future effect.

## Layout and Overflow

- **Parent constraints:** fills the frame's centre, which owns the scroll.
- **Responsive behavior:** absorbs every change in frame width; the flanks do
  not.
- **Scroll owner:** the frame, not this view. A resource that owned its own
  scroll would nest one inside another.
- **Minimum and maximum geometry:** `None`.

## View Invariants

- **The map is total and lives here.** `Record<ScreenKind, Component>` means a
  new kind fails to compile until it has something to render, and the map sits
  in the view that renders the result rather than in a shared registry — which
  the view standard forbids and which no view could import from another anyway.
- **A model key is never a component.** The workbench exposes stable keys
  precisely so it stays testable without a DOM; resolving them is this layer's
  job.
- **Two tabs are two mounts.** The subtree is keyed on the tab, so switching
  between two tabs of the same kind remounts rather than handing one component's
  state to both. Two open documents are not one document.

## Supporting Documents

| Document | Subject |
| --- | --- |
| `None` | — |
