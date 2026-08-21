# Function Builder

| Modal | What it is for | Regions |
| --- | --- | --- |
| Function Builder | Writing an expression against everything the project can refer to, with the whole vocabulary in front of you | Expression · Search · Filters · Results · Descriptions · Name |

Opened from the [Variables](../context/project/variables.md) actions row. It is a modal
rather than a panel because an expression has to be *constructed* — it has parts
that must agree, and a 300px column is not where that happens.

It uses the workspace shape because the centre is what the shell's centre is: a
plane with regions beside one another. `OverlayModal` supplies the frame, so the
title, the escape behaviour and the confirm belong to it and are not drawn here.

**Dismissing discards.** That is the primitive's decision, and it is the right
one here: a half-built expression that survived against a cell you have moved on
from is a trap. With anything typed, `unsaved` guards every way out.

## Data

| Source | Kind | Provides |
| --- | --- | --- |
| `capabilities.variables.list` (new) | Capability | every `NameVariable` in the project |
| `capabilities.formula.builtins` (new) | Capability | the built-in functions, with a signature, a category and a description |
| `capabilities.variables.define` (new) | Capability | writes the expression as a `function` variable, when it is being kept |

The built-ins are a capability rather than a constant so the list the modal
shows and the list the evaluator honours cannot drift apart.

## Layout

`OverlayModal` at `width="wide"` — 672px. The expression spans both tracks
because it is the subject; the two result columns are the reference beneath it.

| 2fr | 3fr |
| --- | --- |
| expression | expression |
| search | filters |
| results | descriptions |
| results | descriptions |
| name | name |

**The tracks are 2fr/3fr, not 1fr/3fr.** A quarter of 672px is 160px, and the
identity column carries a name *and* a value — `hardeningBudget` beside
`46,000,000` does not fit in 160px. The [Variables panel](../context/project/variables.md)
does exactly this pairing in 300px, which is what the left track is sized to
match. The remaining 400px is a comfortable 60–70 characters of description,
which is what two clamped lines want.

There is no actions region. The confirm is `OverlayModal`'s footer, which is the
same on every modal and is therefore not drawn — but *Name* is deliberately the
last row of the body, directly above it, because the name is what decides which
confirm the footer shows.

## Expression

Where the expression is written, and the reason the modal exists. It grows with
what is typed, because an expression that has outgrown its box is one you can no
longer check.

**Example** — `SUM(outageEvents.customerMinutes) / COUNT(substations)`

### Structure

- `PanelField` `stacked` — label above, so the expression gets the full width
  - `Textarea` — from
    [simple-components](../../../app/src/lib/simple-components/textarea/),
    auto-grown rather than scrolled
    - a completion list, anchored to the caret. `Popover`, not `Select`: it
      follows a position in the text rather than a control

### Props

`value`, `oninput`, and an auto-grown row count with a floor of three lines, so
the field reads as somewhere to write a formula rather than somewhere to type a
word.

### Behavior

Typing a bare name offers completions over the variables and the built-ins, and
accepting one inserts it at the caret. Selecting a result below inserts at the
caret too, so the list and the completions are one gesture apart rather than two
different ways in.

Nothing parses the expression, so completion cannot know where a name may legally
appear. It offers every name after any non-identifier character, and sometimes
offers one that cannot be used — the cost of not carrying a parser in the client.

## Search

The field, and what it narrows. One bar across the top of the reference below it.

**Example** — placeholder "Search variables and functions", "18 of 96"

**Nests** — filters, in its `children` slot

### Structure

- `ScreenFilters` — its field and matched-of-total count are the same ones every
  filter in the application uses

### Props

`placeholder`, `matched`, `total`, `value`. No `sorts`: the list is ordered by
kind and then by name, and an order control over a reference you are scanning is
a control nobody touches.

### Behavior

Narrows by name and by description text as you type, over what the chips have
already admitted. Nothing matching is `ScreenEmpty` `kind="no-matches"` with
`onclear`.

## Filters

Three chips, on one axis. What kind of thing you are looking for — not what
category of function, which is in the list itself.

The axis matters. Functions, Variables, List/Range, Text, Maths and Statistics in
one row are two axes wearing one: the first two say what kind of thing, the rest
say what category of function, and they are meaningless together. A person
choosing Variables and Maths has asked for nothing and the control cannot say so.
The categories are not lost — they are `ScreenGroup` bands in the list, where a
taxonomy is scanned rather than operated.

**Example** — `All` `Variables` `Functions`, with Functions on

### Structure

- `ToggleGroup` — from
  [simple-components](../../../app/src/lib/simple-components/toggle-group/),
  sitting between the field and where an order control would be

### Props

Three options: All · Variables · Functions. Single-select, because they are one
axis and two of them at once is the same as All.

### Behavior

Choosing narrows the list below. All restores it.

## Results

The vocabulary, one row each: the name on the left, and the value or the type on
the right — the same pairing the Variables panel keeps, so the two read alike.

**Example** — **Maths** · `SUM(range)` · function · `ROUND(n, digits)` · function
· **Variables** · `outageEvents` · table · `hardeningBudget` · 46,000,000

**Nests** — descriptions, as the third cell of every row

### Structure

- `ScreenTable` — one table across both columns, so the seam between them is the
  table's rather than a border drawn twice
  - `ScreenGroup` — one band per function category, plus one for variables. This
    is where the six-chip taxonomy went
    - `ScreenRow` — one per variable or built-in
      - `ScreenCell` `name` — the identity column, a button through `onselect`
      - `ScreenCell` `num` — the value or the type

### Props

`ScreenGroup` takes `label` and `count`. `ScreenCell` takes `name` for the
identity column and `onselect`, which renders it as a button; `num` for the value
column, so figures line up.

### Behavior

Selecting a row inserts it into the expression above at the caret. The row stays
selected so the description beside it is what you are reading. Inserting rather
than copying is what the modal exists for, and there is always a caret here.

## Descriptions

What each row means, with an example where it is a built-in. Two lines until you
ask for more.

**Example** — "SUM(range) — adds every number in a range, ignoring text and
blanks. `SUM(A1:A20)`"

### Structure

- `ScreenCell` — the third cell of each *Results* row, holding prose rather than
  a value. Not a table of its own: a second table beside the first would have its
  own row heights and the two would drift apart as soon as one row expanded

### Props

The description text, and a clamp of two lines.

### Behavior

Clicking expands that row to the whole description and clicking again collapses
it. A variable with no description says so rather than rendering an empty column,
which is most of them until `NameVariable` carries one — an argument for the
built-ins landing first.

## Name

Whether the expression is being kept, and under what name. Last row of the body,
directly above the footer it governs.

**Example** — empty, with **Copy & Close**; then `avoidedMinutes`, with **Save &
Close**

### Structure

- `PanelField` `stacked` — the panel vocabulary inside the modal, which shares
  the panel's 12px gutter so the labels line up with the title above
  - `PanelEditableText` — the name field

### Props

`label` "Name", `value`, `onchange`, and a placeholder saying what leaving it
empty means.

### Behavior

Leaving it empty means the expression is not being saved, and `OverlayModal`'s
`confirm` reads **Copy & Close** — the expression goes to the clipboard, always
and only there. The modal does not remember where it was opened from and does not
try to insert: one behaviour that is true every time beats two that a person has
to work out from context, at the cost of a paste.

Typing a name changes the confirm to **Save & Close**, and confirming writes a
`function`-typed variable. A name already taken fills the primitive's `blocked`,
which disables the confirm and says why beside it — a name conflict is decided
before the value is validated, so it is the only thing that needs saying.
