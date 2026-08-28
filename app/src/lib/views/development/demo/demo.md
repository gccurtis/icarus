# Demo

Lives at `src/lib/views/demo/demo.md`. Trees live in the
concern documents linked below.

## Purpose

The design system reference, rendered at `/demo`. It shows the public token
vocabulary and every primitive component family against it.

## Boundary

This view owns:

- the section order, page width, padding, and gaps between sections;
- the local state each section uses to drive its own examples;
- the active chromatic theme, selected in `components/appearance-bar.svelte` and
  applied to the document root;
- the single permitted read of private `--palette-*` properties, in
  `components/palette.svelte`.

It does not own:

- the tokens or themes themselves — those belong to
  [the styles directory](../../../../docs/styles-directory/styles-directory.md);
- the primitive components it demonstrates, which belong to
  `simple-components/` and are consumed unmodified;
- the default appearance at first paint, which `app.html` declares.

## Public Contract

- **Entry:** [`demo.svelte`](demo.svelte)
- **Types:** `None`

| Kind | Name | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| — | `None` | — | — | The view takes no props; the route renders it directly |

## Dependencies

### Client models

| Door | Usage |
| --- | --- |
| `None` | This surface renders the styling pipeline, not application state |

### Capabilities

| Browser door | Usage |
| --- | --- |
| `None` | |

### Composed views

Views reached through their root component only.

| View | Root imported | Usage |
| --- | --- | --- |
| `None` | | |

### Presentation

| Dependency | Usage |
| --- | --- |
| `$lib/components/vendor/*` | Every primitive family the page demonstrates, plus `Separator` between sections |
| `--token-*` | The public vocabulary every section renders |
| `--palette-*` | `components/palette.svelte` only, as the named style-lint exception |

## Directory Documents

| Concern | Document | What it owns |
| --- | --- | --- |
| Components | [components.md](components/components.md) | The thirteen sections, the appearance bar, the shared heading, and which components hold local state |
| Effects | [effects.md](effects/effects.md) | Applying the selected theme and set to the document root, and persisting them |

`interactions/`, `shared/`, and `procedures/` are absent. The view coordinates no
model or capability work, and no state is shared between sections.

## Rendered States

| State | Trigger | Visible result | Available recovery |
| --- | --- | --- | --- |
| Initial | Route render | Every section, in order | — |
| Loading | `None` | | |
| Empty | `None` | | |
| Stale | `None` | | |
| Failure | `None` | | |
| Denied | `None` | | |

## Accessibility

- **Landmark and accessible name:** The page `h1` is "Design system"; each
  section carries an `h2` from `section-heading.svelte`.
- **Initial focus:** Document default. The view moves focus nowhere on mount.
- **Keyboard model:** Each demonstrated primitive keeps its own keyboard
  behavior. The only shortcut the view adds is `Ctrl`/`⌘`+K in
  `components/disclosure.svelte`, which opens the command dialog.
- **Announcements:** `None`.
- **Focus restoration:** Owned by the overlay primitives that take focus.

## Layout and Overflow

- **Parent constraints:** Rendered directly by the route inside the root layout.
- **Responsive behavior:** Column at `max-w-5xl`, centered, with page padding.
  Sections lay out their own contents.
- **Scroll owner:** The document. No section scrolls internally except
  `structure.svelte`, which demonstrates a scroll area.
- **Minimum and maximum geometry:** Maximum width `5xl`; no minimum.

## View Invariants

- No component references a private stage namespace except
  `components/palette.svelte`.
- No section reads the client model or calls a capability.
- Section state stays in the section that owns it; nothing is shared.
- Appearance reaches the page through `data-theme` on the document root, never
  through props.
- Primitives are consumed unmodified. A primitive that needs different behavior
  is wrapped by a component here rather than edited in `simple-components/`.

## Supporting Documents

| Document | Subject |
| --- | --- |
| `None` | |
