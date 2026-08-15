# {{View Name}}

Lives at `src/lib/views/{{view-name}}/{{view-name}}.md`. Trees live in the
concern documents linked below.

## Purpose

TODO: State what the user sees, what task this view enables, and when it is
rendered.

## Boundary

This view owns:

- TODO: Rendered state or behavior controlled by this view.

It does not own:

- TODO: State or behavior delegated to a route, client model, capability, or
  parent surface.

## Public Contract

- **Entry:** [`{{view-name}}.svelte`]({{view-name}}.svelte)
- **Types:** TODO: Link `types.ts`, or write `None`.

| Kind | Name | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| Prop, event, or snippet | TODO | TODO | Yes or no | TODO |

## Dependencies

### Client models

| Door | Usage |
| --- | --- |
| TODO or `None` | TODO |

### Capabilities

| Browser door | Usage |
| --- | --- |
| TODO or `None` | TODO |

### Composed views

Views reached through their root component only.

| View | Root imported | Usage |
| --- | --- | --- |
| TODO or `None` | TODO | TODO |

### Presentation

| Dependency | Usage |
| --- | --- |
| Simple component, token domain, or `None` | TODO |

## Directory Documents

Include only directories present in the view.

| Concern | Document | What it owns |
| --- | --- | --- |
| Components | [components.md](components/components.md) | TODO |
| Interactions | [interactions.md](interactions/interactions.md) | TODO |
| Effects | [effects.md](effects/effects.md) | TODO |
| Shared | [shared.md](shared/shared.md) | TODO |
| Procedures | [procedures.md](procedures/procedures.md) | TODO |

## Rendered States

| State | Trigger | Visible result | Available recovery |
| --- | --- | --- | --- |
| Initial | TODO | TODO | TODO |
| Loading | TODO or `None` | TODO | TODO |
| Empty | TODO or `None` | TODO | TODO |
| Stale | TODO or `None` | TODO | TODO |
| Failure | TODO or `None` | TODO | TODO |
| Denied | TODO or `None` | TODO | TODO |

## Accessibility

- **Landmark and accessible name:** TODO
- **Initial focus:** TODO
- **Keyboard model:** TODO
- **Announcements:** TODO
- **Focus restoration:** TODO

## Layout and Overflow

- **Parent constraints:** TODO
- **Responsive behavior:** TODO
- **Scroll owner:** TODO
- **Minimum and maximum geometry:** TODO

## View Invariants

- TODO: State a condition that must remain true across the rendered tree.
- TODO: State an ownership, focus, or state-lifetime invariant.

## Supporting Documents

Include only when `docs/` has entries.

| Document | Subject |
| --- | --- |
| TODO or `None` | TODO |
