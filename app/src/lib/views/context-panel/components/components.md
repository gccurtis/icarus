# Context Panel Components

Lives at `src/lib/views/context-panel/components/components.md`. This is the one
document for the complete recursive component tree. Nested component directories
do not carry their own Markdown files.

## Component Tree

```text
context-panel.svelte
├── rail                             components/rail.svelte
├── overview                         components/overview.svelte
├── outline                          components/outline.svelte
├── project-overview                 components/project-overview.svelte
├── project-resources                components/project-resources.svelte
├── project-mentions                 components/project-mentions.svelte
├── project-people                   components/project-people.svelte
├── project-activity                 components/project-activity.svelte
├── project-tasks                    components/project-tasks.svelte
├── project-health                   components/project-health.svelte
├── project-variables                components/project-variables.svelte
├── project-contexts                 components/project-contexts.svelte
├── project-templates                components/project-templates.svelte
├── newtab-create                    components/newtab-create.svelte
├── newtab-recent                    components/newtab-recent.svelte
├── newtab-templates                 components/newtab-templates.svelte
└── newtab-bring-in                  components/newtab-bring-in.svelte
```

The root renders the rail always and exactly one content component, chosen by
the key below.

## Inventory

Maintained by `pnpm new-view-part`; only the block between the markers is
rewritten. Every authored component appears here, and each meaningful one is
described under Subtree Contracts below.

<!-- generated:inventory:start -->
- [`newtab-bring-in.svelte`](newtab-bring-in.svelte)
- [`newtab-create.svelte`](newtab-create.svelte)
- [`newtab-recent.svelte`](newtab-recent.svelte)
- [`newtab-templates.svelte`](newtab-templates.svelte)
- [`outline.svelte`](outline.svelte)
- [`overview.svelte`](overview.svelte)
- [`project-activity.svelte`](project-activity.svelte)
- [`project-contexts.svelte`](project-contexts.svelte)
- [`project-health.svelte`](project-health.svelte)
- [`project-mentions.svelte`](project-mentions.svelte)
- [`project-overview.svelte`](project-overview.svelte)
- [`project-people.svelte`](project-people.svelte)
- [`project-resources.svelte`](project-resources.svelte)
- [`project-tasks.svelte`](project-tasks.svelte)
- [`project-templates.svelte`](project-templates.svelte)
- [`project-variables.svelte`](project-variables.svelte)
- [`rail.svelte`](rail.svelte)
<!-- generated:inventory:end -->

## Subtree Contracts

### `rail`

- **Root:** [`rail.svelte`](rail.svelte)
- **Purpose:** the fixed strip that chooses what the panel shows.
- **Inputs:** the display copy for every context, the ids this screen kind
  offers in order, the selected id, and a select callback.
- **Outputs:** one select call carrying a `ContextId`.
- **Owned children:** `None`
- **Behavior delegated to the view root:** resolving the choice. The rail
  reports which id was picked and never renders the result.
- **Focus behavior:** each entry is an ordinary button in tab order. It takes no
  focus and restores none.
- **Layout and overflow:** a fixed column at `RAIL_WIDTH`; never scrolls, never
  collapses.
- **Accessibility:** a `navigation` landmark named "Contexts". Entries are
  icon-only, so each carries its context name as its accessible name, and the
  selected one carries `aria-current` plus an edge marker so selection does not
  ride on colour.

**Why it takes props instead of reading the model.** The root already reads the
resolved context to choose the content component. A rail that read it too would
make the same key resolve in two places, and the map would have to exist in both.

**A ten-entry rail is the current maximum**, and it is the project overview's.
At `RAIL_WIDTH` with 32px targets that fits without scrolling in any realistic
zone height; a screen that wants more than about a dozen needs a different
answer, not a scrolling rail.

### Content components

Every content component takes the active tab's `Tab` and renders what surrounds
it. None reads the model for *which* context it is: the root resolves the key
and passes the resource, so a context component stays a function of its input
and the panel has one reader.

All are **fixtures**. Real content needs capabilities that do not exist, and
inventing a shared store to fake one would be a worse lie than a visibly static
list. What they prove is that the panel re-resolves when the active tab changes,
and that selecting anything inside one reaches the inspector.

### `overview` and `outline`

The two generic contexts, offered by screens that have no rail of their own yet.
Each names the resource it is looking at, so a tab switch is visible in the panel
as well as in the centre.

- **Inputs:** the active tab
- **Outputs:** `None`
- **Owned children:** `None`
- **Layout and overflow:** fills the content half; does not own a scroll

### The project overview's ten

- **Roots:** [`project-overview.svelte`](project-overview.svelte),
  [`project-resources.svelte`](project-resources.svelte),
  [`project-mentions.svelte`](project-mentions.svelte),
  [`project-people.svelte`](project-people.svelte),
  [`project-activity.svelte`](project-activity.svelte),
  [`project-tasks.svelte`](project-tasks.svelte),
  [`project-health.svelte`](project-health.svelte),
  [`project-variables.svelte`](project-variables.svelte),
  [`project-contexts.svelte`](project-contexts.svelte),
  [`project-templates.svelte`](project-templates.svelte)
- **Purpose:** the rail specified in
  `docs/screen-panel-views/screens/project-overview/overview.md`, one component
  per view.
- **Inputs:** the active tab, which none of them reads — the project overview is
  a singleton, so there is nothing about the tab that varies. They take it
  because every content component has the same signature.
- **Outputs:** `None` directly. Each writes inspections through the workbench, so
  selecting a row in a panel changes what the inspector shows.
- **Owned children:** `None`. All ten are built from
  `$lib/unique-components/panel`, which is where their shape lives.
- **Layout and overflow:** each fills the zone and owns its own scroll, because
  `Panel` pins the title and its controls and scrolls everything under them.
- **Accessibility:** a heading per panel, `bits-ui` disclosures per section, and
  rows that are buttons only when they do something.

**Why one file per view rather than one file with ten branches.** The views have
almost nothing in common beyond their frame: Mentions is a feed, Variables is a
name manager, Health is a diagnostic. Branching would put ten unrelated
concerns behind one import and make the rail's map a lie — the map is what says
these are ten separable things.

## Key Selection

- **Key:** `ContextId`, from
  [`../procedures/resolve-context.ts`](../procedures/resolve-context.ts).
- **Selected by:** [`context-panel.svelte`](../context-panel.svelte), which reads
  the resolved context and renders the match.

| Key value | Renders | Component |
| --- | --- | --- |
| `overview` | What surrounds the resource at project level | [`overview.svelte`](overview.svelte) |
| `outline` | The resource's own structure | [`outline.svelte`](outline.svelte) |
| `project` | The project: what it is, its state, who is here, what needs you | [`project-overview.svelte`](project-overview.svelte) |
| `resources` | Everything that exists, grouped by kind | [`project-resources.svelte`](project-resources.svelte) |
| `mentions` | What a person addressed to you | [`project-mentions.svelte`](project-mentions.svelte) |
| `people` | Everything that can appear as "who did this" | [`project-people.svelte`](project-people.svelte) |
| `activity` | What has happened, newest first | [`project-activity.svelte`](project-activity.svelte) |
| `tasks` | Agent work, by state | [`project-tasks.svelte`](project-tasks.svelte) |
| `health` | Only what genuinely cannot proceed | [`project-health.svelte`](project-health.svelte) |
| `variables` | The project's named tables, values and functions | [`project-variables.svelte`](project-variables.svelte) |
| `contexts` | Saved scopes, and the way to the Context screen | [`project-contexts.svelte`](project-contexts.svelte) |
| `templates` | Templates, grouped by what they make | [`project-templates.svelte`](project-templates.svelte) |
| `newtab-create` | The three editors, listed | [`newtab-create.svelte`](newtab-create.svelte) |
| `newtab-recent` | What you had open lately, by day | [`newtab-recent.svelte`](newtab-recent.svelte) |
| `newtab-templates` | Starting from something rather than nothing | [`newtab-templates.svelte`](newtab-templates.svelte) |
| `newtab-bring-in` | Getting outside material in | [`newtab-bring-in.svelte`](newtab-bring-in.svelte) |

Total in both directions: every id has a component, and no component here is
unreachable by a key. The map is a `Record<ContextId, …>`, so a new id fails to
compile until it has a row.

No exception, and no unknown-key branch. The model guarantees the resolved
context is an id this screen kind offers, falling back to the kind's default when
a stored one no longer resolves.

**One id is one component, everywhere it appears.** `variables` is the project
Name Manager on every screen that can hold a formula, so it is one id and one
file. Where a name means genuinely different content per screen — every screen
has an "Overview", and no two show the same thing — the ids differ and the
*labels* collide instead. `project` is that case: it is the project overview's
own orientation view, labelled "Overview" like the rest of them.

**Which ids are offered is not this view's decision.** `CONTEXTS_BY_SCREEN` maps
each screen kind to its rail, so `project-overview` offers ten while `document`
offers `outline` first and `overview` second. That is why the rail itself changes
when the active tab does.

## Tree Invariants

- **The rail decides, the content displays.** Neither reaches into the other,
  and the root is the only thing that knows both.
- **The map is the root's.** A component here never resolves a `ContextId`; the
  rail is handed copy, and the content component is already the answer.
- **One scroll context, and it is the panel's.** The zone hands its full height
  down; `Panel` decides which band scrolls, because pinning the title row is a
  decision no wrapper outside it can make. A filter is not pinned by the frame —
  `PanelSearch` contains what it filters and scrolls with it.
- **A context view writes inspections, never view state.** Selecting a row sets
  a key through the workbench. Nothing here edits what it is listing.
