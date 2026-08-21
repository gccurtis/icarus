# The panel trees

Four trees under `src/lib/`, built from
[`docs/screen-panel-views`](../../../docs/screen-panel-views/README.md). Each file
there becomes one component here, at the same path.

| Tree | Alias | Holds | Shape |
| --- | --- | --- | --- |
| `context/` | `$context` | one component per context-panel view | a vertical stack |
| `inspector/` | `$inspector` | one component per kind of thing you can select | a vertical stack |
| `workspaces/` | `$workspaces` | the centre of a screen, one file or one per state | a grid |
| `modals/` | `$modals` | work that wants the whole screen | a grid inside `OverlayModal` |

```text
docs/screen-panel-views/context/project/variables.md
  → src/lib/context/project/variables.svelte

docs/screen-panel-views/inspector/collaboration/person.md
  → src/lib/inspector/collaboration/person.svelte

docs/screen-panel-views/screens/project-overview/workspace.md
  → src/lib/workspaces/project-overview/workspace.svelte
```

These are not views. `src/lib/views/` and its standard are untouched: a view knows
the application exists and is linted for it. A panel here knows only its data
doors, which is what makes it renderable anywhere — a gallery, a test, a screen it
was not written for.

## A panel is a vertical stack

`Panel` is the root of every file in `context/` and `inspector/`. It supplies the
title, an optional breadcrumb, an actions row under the title, and the zone's only
scroll. Everything else is stacked in its body, in the order the specification's
layout table gives.

There is no footer, and one should not be added: every control that ended up in
one was buried under content of unbounded length. Controls go in the `actions`
snippet. A **bounded** form is the exception — its commit is the last thing in the
body, because the last thing in a three-field form is the last thing on screen.

## A workspace is a grid

The specification's layout table *is* `grid-template-columns` and
`grid-template-areas`. Write it as both, in a `<style>` block, with the areas named
for the region labels:

```css
.board {
  display: grid;
  grid-template-columns: 2fr 3fr;
  grid-template-areas:
    "header header"
    "create feed";
}
```

`ScreenSurface` is the root. One column below the width where the tracks stop
being readable.

## Data comes from a capability or a model

Two doors, and nothing else. No props carrying content, no fetches, no constants
standing in for a query.

| Door | Import | For |
| --- | --- | --- |
| The store | `$json-store/client` | anything one of the thirty-four tables holds |
| The model | `$model/client` | the real workbench, where a client instance exists |
| A mock door | `$mock-capabilities/<subject>` | a table or projection that does not exist yet |
| A mock model | `$mock-models/workbench.svelte` | inspection and selection, without a client instance |

**The project is never a prop.** It is read from `/app/[project]` once and carried
on the model.

A prop is for what no door can supply — a callback upward, an id the parent alone
knows. `personId`, `onback`, `open`. Nothing else.

### Mock doors

One module per subject, mirroring the subject directories in the specifications:
`project`, `resource`, `library`, `scope`, `analysis`, `research`, `agents`,
`collaboration`, `copilot`, `formula`. Every door returns a
[`Read<T>`](../../src/lib/mock-capabilities/read.ts) — the same `current` /
`error` / `refresh` handle `$json-store/client` returns — so swapping a mock for
the real door is an import change rather than a rewrite.

Sample content comes from [`cast.ts`](../../src/lib/mock-capabilities/cast.ts) and
nowhere else. One project, one set of people, one set of resources, so a name in
the Mentions panel is the same person as the avatar in the comment lens. Sample
content that disagrees with itself across three panels makes a reviewer chase a
bug that does not exist.

## Components

Two vocabularies, and a panel uses one of them.

- [`unique-components/panel`](../../src/lib/unique-components/panel/index.ts) —
  `Panel`, `PanelSection`, `PanelRow`, `PanelFields`, `PanelField`, `PanelSearch`,
  `PanelChoice`, `PanelSelect`, `PanelToggle`, `PanelEditableText`, `PanelPairs`,
  `PanelPair`, `PanelActor`, `PanelFaces`, `PanelThumbs`, `PanelThumb`,
  `PanelButton`, `PanelActions`, `PanelChip`, `PanelNote`, `PanelQuote`,
  `PanelCode`, `PanelCrumbs`, `PanelLink`, `PanelProgress`, `PanelSkeleton`
- [`unique-components/screen`](../../src/lib/unique-components/screen/index.ts) —
  `ScreenSurface`, `ScreenHeader`, `ScreenBar`, `ScreenAction`, `ScreenFilters`,
  `ScreenTable`, `ScreenHeadCell`, `ScreenRow`, `ScreenCell`, `ScreenGroup`,
  `ScreenCards`, `ScreenCard`, `ScreenShelf`, `ScreenShelfItem`, `ScreenThumb`,
  `ScreenStats`, `ScreenStat`, `ScreenBanner`, `ScreenNote`, `ScreenStrip`,
  `ScreenPlaceholder`, `ScreenEmpty`

Anything with a control inside it is `simple-components` underneath. Reach for
those directly — `Button`, `Textarea`, `HoverCard`, `ToggleGroup`, `Separator`,
`Tabs` — where the panel vocabulary has no word for what is needed.

**A component that does not exist gets built** in the vocabulary it belongs to,
with a docstring saying what it is for and why it is not one of its neighbours.
It is a primitive: it knows only its props and never reaches a door.

## Styling

Public tokens only — `--token-*` — plus the Tailwind classes the integration
publishes. No literal colours, no literal radii. A dimension particular to one
panel lives in that panel's `<style>` block, expressed off
`--token-spacing-unit`.

## What a file says

A docstring at the top of `<script>`: what the panel is, which specification file
it comes from, and the one or two decisions a reader would otherwise ask about.
Inline comments only where the markup cannot say it — a nesting that carries a
claim, a control that is deliberately absent.
