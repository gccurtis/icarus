# Core

Lives at `src/lib/views/core/core.md`. Trees live in the concern
documents linked below.

## Purpose

The work surface: whatever the active tab holds, rendered on the generous plane
at the centre of the frame.

It fills from view state rather than from the route, and that is what makes tabs
possible at all. Switching tabs is not a navigation, so nothing about what is
open is expressible as a URL segment — a centre that took route content could not
follow a tab.

## Boundary

This view owns:

- turning a screen and a subscreen into the path of a centre, and loading it;
- the three states a load can reach: waiting, no such file, and a module that
  threw;
- the rule that two tabs are two mounts, even when they hold the same screen.

It does not own:

- which tab is active, or what it holds. Both are model state.
- display copy for a screen. The tab bar owns the label and icon, because that is
  the surface that displays them.
- the scroll. The frame's centre owns it, so a resource cannot take the page
  with it.

## Public Contract

- **Entry:** [`core.svelte`](core.svelte)
- **Types:** `None`

| Kind | Name | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| — | — | — | — | Nothing. It reads view state directly. |

## Dependencies

### Client models

| Door | Usage |
| --- | --- |
| `$model/client/view-state` | `active.screen`, `active.subscreen`, `activeId` |

### Capabilities

| Browser door | Usage |
| --- | --- |
| `None` | — |

### Composed views

| View | Root imported | Usage |
| --- | --- | --- |
| `None` | — | — |

The thirteen centres under `$lib/views/workspaces/` are reached through a glob rather
than by import, so none of them is named here. A centre that grows past a screen
becomes a sibling view and is imported through its root. None has yet.

### Presentation

| Dependency | Usage |
| --- | --- |
| Token domains: color, spacing, typography | Inherited by what it renders; this view declares none of its own |

## Directory Documents

No concern directories. The whole view is a path, a glob and three states — there
is nothing to coordinate and no vocabulary to hold.

## Rendered States

| State | Trigger | Visible result | Available recovery |
| --- | --- | --- | --- |
| Initial | Always | The active tab's centre | — |
| Switched | A different tab is activated | The new tab's centre, freshly mounted | — |
| Loading | A centre's chunk is in flight | Nothing, for one frame | — |
| Missing | The path names no file in the glob | The path, in mono | — |
| Failure | The module threw while evaluating | The path and the reason | — |
| Empty | `None` | — | — |
| Stale | `None` | — | — |
| Denied | `None` | — | — |

No empty state. `activeId` always names a real tab, because a permanent tab
cannot be closed.

Missing and Failure are separate because they are different diagnoses. The glob
cannot name a file that is not there, so a rejected import means the module
itself threw — and telling "this screen has not been built" from "this screen is
broken" is the whole value of the two branches.

## Accessibility

- **Landmark and accessible name:** none of its own. The frame's centre is the
  `main` landmark and this view renders inside it.
- **Initial focus:** none taken.
- **Keyboard model:** whatever the centre brings.
- **Announcements:** `None` yet. A tab change replaces this whole subtree
  silently; announcing it is a decision for the first centre that takes focus.
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

- **The registry is the filesystem.** There is no map from screen to component
  here, because a map is a second list of what exists and the first one is
  `src/lib/views/workspaces/`. A screen and a subscreen name a path, and the same fact
  generates the vocabulary the model publishes, so the two cannot disagree.
- **A model key is never a component.** View state exposes stable keys precisely
  so it stays testable without a DOM; resolving them is this layer's job.
- **A chunk that fails to arrive is a state, not a blank plane.** Rendering
  nothing for a broken module leaves a reader looking at an empty centre with no
  way to tell it from a screen that is meant to be empty.
- **Two tabs are two mounts.** The subtree is keyed on the tab and its subscreen,
  so switching between two tabs of the same screen remounts rather than handing
  one component's state to both. Two open documents are not one document.

## Supporting Documents

| Document | Subject |
| --- | --- |
| `None` | — |
