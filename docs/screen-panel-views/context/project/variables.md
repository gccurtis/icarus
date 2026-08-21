# Variables

| View | What it is for | Sections |
| --- | --- | --- |
| Variables | The project's Name Manager — every named table, value and function, and the only place they are created | Actions · Search · Filters · Variables |

Anywhere a formula can be written, this is where you find out what a formula can
refer to. A variable is stored as a *value*, not as an expression: what this view
shows is exactly what a formula will get when it runs. That is why nothing here
is ever stale, and why no section carries a refresh.

Present on Project Overview, the document, deck and spreadsheet editors, and both
Analysis subscreens. Analysis shows the same variables with their fields expanded
underneath, because there you are dropping a field rather than referring to a
name — see [analysis/context/variables.md](../analysis/variables.md).

## Data

| Source | Kind | Provides |
| --- | --- | --- |
| `capabilities.variables.list` (new) | Capability | every `NameVariable` in the project, in `definitionOrder` |
| last-focused editable (new) | Model | where a clicked name gets inserted, since clicking the panel blurs the caret |

## Layout

| Label | Components |
| --- | --- |
| actions | `PanelButton` ×2 |
| | `Separator` |
| search | `PanelSearch` |
| filters | `PanelChoice` |
| variables | `PanelFields` |

Four bands, and the order is what the panel is for: what you can make, then what
you are looking for, then what there is. Each band is narrower in scope than the
one above it.

## Actions

The two things this panel makes. At the top because `Panel` has no footer — what
a panel offers has to be visible before what it lists, since the list is why the
reader is looking down.

**Example** — **Create variable** · **Function Builder**

### Structure

- `PanelButton` `tone="primary"` — **Create variable**, switching the panel to
  [Create variable](variables-create.md)
- `PanelButton` — **Function Builder**, opening
  [the Function Builder](../../modals/function-builder.md)
- `Separator` — under the pair, dividing what the panel offers from what it lists

### Props

`label` and `onclick` each. Only the first is `primary`: defining a variable is
why a person opens this panel, and the builder is the specialist path.

### Behavior

Create variable replaces the three bands below with the create form and puts a
breadcrumb back. Function Builder opens a modal over the work surface, leaving
the panel as it was.

## Search

The field, and what it narrows.

**Example** — placeholder "Search variables", "12 of 41"

**Nests** — filters, variables

### Structure

- `PanelSearch` — the field, its matched-of-total count, and its own
  nothing-matches sentence

### Props

`placeholder`, `matched`, `total`, `value`. The count is matched-of-total, so a
filtered list never reads as the whole.

### Behavior

Narrows by name as you type, over what the chips below have already admitted.
Nothing matching is `PanelSearch`'s own sentence rather than an empty panel,
which is the one outcome a filter has that its caller cannot draw better.

## Filters

Three chips and an All, above the list they narrow.

The chips do not follow `ValueType`, and that is deliberate. Nine types is a
storage taxonomy, not a question anyone asks: ten pills wrapping to three lines
in a 300px column is more chrome than the list it filters, and it makes a person
read a type system to find a name. The question they actually ask is whether a
thing has rows, holds a value, or gets called — which is the same three the panel
used to be sectioned by, and what `PanelChoice` exists for. Tables covers
`table`, `record` and `list`, which the model already treats as tables
degenerately; Values covers the scalars; Functions covers `function`. A case
needing the exact type belongs in the search field as `type:table`, not in a
fourth row of pills.

**Example** — `All` `Tables` `Values` `Functions`, with Tables on

### Structure

- `PanelChoice` — one of a small set, shown rather than hidden, because which one
  is on is the point

### Props

`label` "Show", `value`, and four options: All · Tables · Values · Functions.

### Behavior

One at a time. Choosing narrows the list below; All restores it.

## Variables

Every variable in the project, one row each: the name on the left, and on the
right either the value or the type. A scalar is short enough to show, so it is
shown; anything else names its type and gives the value to a hover.

**Example** — `outageEvents` · table · *hover: 3 of 4,182 rows* ·
`hardeningBudget` · `46,000,000` · `filingDeadline` · `14 Nov 2026` ·
`avoidedMinutes(t)` · function

### Structure

- `PanelFields` — one field per variable, name in the label column
  - `HoverCard` — the value preview, on non-scalar values only. From
    [simple-components](../../../../app/src/lib/simple-components/hover-card/)

### Props

Each `PanelField` takes `label` the authored `name`, and renders the value `mono`
for a scalar or the `declaredType` with a hover preview for the rest. The preview
reads a bounded prefix server-side rather than the whole value — sending 4,182
rows to draw three of them is not acceptable, and the prefix is the capability's
job rather than the panel's.

### Behavior

Clicking a row inserts the name at the caret, in whatever formula or field last
had focus. Where nothing did — Project Overview, or a panel opened before any
editor was touched — it copies to the clipboard instead, and says which of the
two happened.

**The panel has to hold a last-focused editable**, because clicking into the
panel blurs whatever the caret was in. That is one small piece of state, and it
is the same thing the shell already needs so that inspecting never derives from
focus. Without it there is no caret to insert into by the time the click lands.

Nothing here opens an inspector. A variable's name, type and value are all on the
row already, so a lens would be the same four facts in a second column — which is
why the shared one was removed. Analysis keeps
[a variant of its own](../../inspector/analysis/variable.md), because there a
variable has fields and relationships that do not fit a row.
