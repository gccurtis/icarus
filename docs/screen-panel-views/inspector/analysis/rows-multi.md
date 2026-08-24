# Several table rows

| Selecting … | What it is | Sections |
| --- | --- | --- |
| More than one row of a table chart | The selection as a subtotal, and as a thing to edit at once | Crumbs · Selection · Together · In common · Actions |

**It edits all of them; it does not merely list them.** A property the selection
disagrees on is drawn as *Mixed* and typing over it sets every member — a panel
showing one member's answer for all of them would silently overwrite values the
reader never saw.

**Where they agree, they say so rather than saying Mixed.** Mixed is a claim
about disagreement, and using it for "several things" would make the one state
that matters unreadable.

The selection arrives as `at`: a comma-separated list of row ids.

## Data

| Source | Kind | Provides |
| --- | --- | --- |
| `view.selection` | Model | the members, as row ids in `at` |
| `capabilities.analysis.resultFor` | Capability | each member's group and values, the measure columns, and the totals |
| `analysisId` · `at` | Prop | the analysis and the members, where a caller already knows both |

## Layout

| Label | Components |
| --- | --- |
| crumbs | `PanelCrumbs` |
| selection | `PanelSection` |
| together | `PanelSection` |
| in common | `PanelSection` |
| actions | `PanelSection` |

The panel's title is the count — *3 rows*.

## Selection

The members, one row each.

**Example** — "Cedar Hill" · "Rockvale" · "Alder Fork"

### Structure

- `PanelSection` `flush` — one `PanelRow` per member, with a count

### Behavior

Selecting one opens [what is underneath it](mark.md).

## Together

The subtotal.

**Example** — Customer-minutes `3,914,000` · Events `31`; "Share of
Customer-minutes" 66%; `3` of 6 rows · `1–3` positions — "Positions are by
Customer-minutes, high to low."

### Structure

- `PanelSection` *Together* → `PanelFields` — one field per measure, its sum
- `PanelMeter` — the share of the first measure
- `PanelStats` `columns={2}` — how many of the result's rows, and the span of
  positions
- `PanelNote` — what the positions are by, where the table has an order

### Behavior

**Together sums each measure separately.** Customer-minutes and event counts are
different units; a single combined figure across them would be a number with no
name.

The share is against the whole column, and the count is against the drawn rows —
so a selection that is two thirds of what is shown never reads as two thirds of
the project.

## In common

The properties the selection shares.

**Example** — Substation "" · Visibility `Shown`

### Structure

- `PanelSection` *In common* → `PanelFields` → the label, editable, under the
  group column's own heading
- `PanelChoice` **Visibility**, reading *Mixed* where the members disagree
- `PanelNote` — what a choice here took on, or that all of them already agree
- `PanelNote` `tone="gap"`

### Behavior

One control over several rows means nothing unless it sets every one of them,
which is what choosing here does. Visibility is kept per member rather than as
one shared answer: nothing stores a row's visibility, so a selection later
covering rows this panel set differently is genuinely mixed, and one shared value
could never report that.

## Actions

**Example** — **Filter to these** · **Exclude these**

### Structure

- `PanelSection` *Actions* → `PanelActions` → `PanelButton` ×2, each titled with
  the members it names
- `PanelNote` — the rule the press would add, once one has been pressed
- `PanelNote` `tone="gap"`

### Behavior

**A rule over several values needs an *is one of* operator.** The filter model
has `is`, `is not`, `≥`, `≤` and *between*, so this would arrive as one rule per
member or not at all — which is why the buttons state the rule rather than
adding it.
