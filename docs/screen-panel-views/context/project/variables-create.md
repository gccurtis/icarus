# Create variable

| Reached from | What it is | Sections |
| --- | --- | --- |
| **Create variable**, in the [Variables](variables.md) actions row | One variable being defined: its name, its type, and the value it will hold | Crumbs · Name · Type · Value · Accept |

The Variables panel switches to this in place rather than opening a modal. A
variable is defined against the formulas and fields you can see, so the work
surface stays where it is and the panel becomes the form.

The name manager **evaluates nothing**. What is entered here is a value, not an
expression — a variable holding a computed result is computed by whoever sends
it. That is why there is no preview band and nothing to refresh: validation is
structural, and what is stored is exactly what was typed.

## Data

| Source | Kind | Provides |
| --- | --- | --- |
| `capabilities.variables.define` (new) | Capability | writes the `NameVariable`, and rejects a name already taken |
| `capabilities.variables.list` (new) | Capability | the existing names, so a conflict is shown before the write |

## Layout

| Label | Components |
| --- | --- |
| crumbs | `PanelCrumbs` |
| name | `PanelField` + `PanelEditableText` |
| type | `PanelField` + `PanelSelect` |
| value | `PanelField` + one editor per type |
| | `Separator` |
| accept | `PanelButton` |

The three fields are `PanelField`s inside one `PanelFields` block. The block is
not a region: it holds nothing but them, and it makes no decision of its own.

## Crumbs

Where this form sits, and the way out of it.

A context view does not normally have one — it is a way of looking at what
surrounds the work, and it is not inside anything. This one is: the panel has
switched to a state that has to be left, and the trail is what leaves it. That is
why it is drawn here when an inspector lens's identical trail is not.

**Example** — *Variables › Create variable*

### Structure

- `PanelCrumbs` — in `Panel`'s `crumbs` slot, above the title rather than in the
  body, so it does not scroll away from a form that has grown

### Props

`trail` of two: *Variables*, carrying a key, and *Create variable*, carrying
none — the last crumb is where you are and is not a target. `onnavigate` returns
the panel to the list.

### Behavior

Navigating discards the form. Nothing is written and nothing is kept, which is
the same thing every other way out of this state does.

## Name

What the variable is called, and the only thing that can fail before the value is
looked at.

**Example** — `hardeningBudget`

### Structure

- `PanelField` `stacked` — label above and value full width, because a name is
  longer than the third of 300px a panel leaves for its label column
  - `PanelEditableText` — the field itself

### Props

`label` "Name", `value`, `onchange`, and `activate="click"`, since the field is
the reason the panel switched and should not need a second gesture.

### Behavior

The name is checked against the existing names as it is typed, and a collision is
said here rather than after the write. `TargetMargin`, `targetmargin` and
`Target Margin` are the same variable: the check is on the lowercased,
whitespace-normalized `nameKey`, and what is shown back is the casing that was
typed.

## Type

What kind of thing the variable holds. It decides the editor below it.

**Example** — Text · Number · Logic · Date · List · Record · Table · Range ·
Function

### Structure

- `PanelField` `stacked` — as above
  - `PanelSelect` — behind a trigger rather than shown, because nine types is
    more than a row of chips holds at 300px

### Props

`label` "Type", `options` the `ValueType` members, `onchange`.

### Behavior

Choosing a type replaces the value editor below. A value already entered is kept
when the two types can hold the same thing and cleared when they cannot; either
way the panel says which happened rather than silently emptying the field.

## Value

What it holds. One editor per type, in the same `stacked` field the two above
use.

**Example** — `46000000` for a Number; two pairs, `region` / `Northwest` and
`year` / `2026`, for a Record

### Structure

- `PanelField` `stacked` — as above
  - one editor, chosen by the declared type:

| Type | Editor |
| --- | --- |
| Text | `PanelEditableText` `multiline` |
| Number | `PanelEditableText`, numeric and `mono` |
| Logic | `PanelSelect` — true or false |
| Date | `PanelDate` (new) — `@internationalized/date` is already a dependency, and no date control is vendored |
| Function | `PanelEditableText` `multiline` `mono` |
| List | `PanelPairs`, the name column being the ordinal position |
| Record | `PanelPairs` |
| Table | `PanelPairs` for the schema, then `PanelTable` (new) for the rows |
| Range | `PanelEditableText` `mono` |

### Props

`PanelPairs` takes `columns`, `empty`, `count`, `addLabel` and `onadd`; each
`PanelPair` takes `name`, `value`, `onrename`, `onchange` and `onremove`. For a
List the name column is ordinal and `onrename` is absent — positions are not
renamed, they are reordered.

### Behavior

The editor accepts what the declared type can hold and nothing else, because that
is the only validation the name manager performs. A name conflict returns to the
Name field focused, and says the name is taken rather than reporting whatever
schema fault the value happened to carry.

A table typed into a 300px column is the hardest input in the set, so `PanelTable`
takes a pasted TSV block and leaves cell editing to the spreadsheet.

A Range stores the reference as written and nothing resolves it here — what is
validated is that `Outages!A1:D400` parses, not that the sheet exists. It is free
text everywhere except a spreadsheet tab, where it is a picker over the grid
behind the panel: the one place this panel and the work surface talk.

## Accept

The commit, at the end of the form it commits.

`Panel` has no pinned footer and should not gain one — its objection is to a
control buried under content of unbounded length, in the part of a full-height
panel a reader has no reason to look at. This form is three fields. The last
thing in the body is the last thing on screen, which is where a submit belongs
and where a person filling in a form already is when they finish.

**Example** — **Define variable**

### Structure

- `Separator` — above it, closing the form
- `PanelButton` `tone="primary"` — **Define variable**, full width

### Props

`label`, `onclick`, and `disabled` while the name is empty or already taken, so
the one thing that can fail is answered before the press.

### Behavior

Writing returns the panel to the list with the new row selected — the breadcrumb
does not have to be used to get back, because succeeding is a way back too.

**There is no Cancel.** The breadcrumb is the way out, and a Cancel beside the
commit would be a second one that reads as the more deliberate of the two. A form
with nothing typed in it needs no confirmation to leave, and a form with something
in it is left the same way anything else is.

**The form is component state and does not survive leaving it.** The breadcrumb,
another rail icon, or a tab switch all discard what has been entered. That is the
honest report of what the client holds — there is nowhere to park a half-defined
variable, and one that reappeared against a project that has moved on is worse
than one that did not. The form says so under the accept, where it is read before
the work is done rather than in a dialog after.
