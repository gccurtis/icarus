# Components and states

> **Committed stance.** Discipline rather than values. This is what every
> component must satisfy, whatever library ultimately provides it.

A component is an instrument. Instruments are judged on whether they report their
condition honestly, so the state matrix below is the part of this document that
matters most.

## Component principles

- **One primary action per region** where possible. Two primary actions is a
  design that has not decided.
- **Inputs have visible boundaries.** A placeholder is not a label; it disappears
  exactly when the user needs it.
- **Dropdowns are keyboard-operable, predictable, and reserved for named
  secondary groups** — never a parking lot for whatever did not fit.
- **Permanent destinations and closable tabs look different.** If a tab that
  cannot be closed renders identically to one that can, a user learns the
  difference by losing work.
- **Tables carry their weight.** Clear hover, selection, sorting, filtering, and
  dense metadata, with `tabular-nums` in every numeric column.
- **Live objects get a restrained treatment.** A bound value, an embedded chart,
  or an interactive block is marked as live and bound, not decorated. Its detail
  moves to the inspector or drawer rather than expanding in place.
- **Derived output is attributable.** Anything the system produced rather than
  the user carries who made it, when, from what, and how to undo it.

## Iconography

- **Labels before icons** for common or consequential actions. An icon-only
  control is legitimate for a dense, repeated affordance whose meaning is
  established elsewhere on the same screen.
- **Never icon-only for meaningful live state.** A state a user must act on gets
  words. This is the [color law](../catalog/color-system.md#usage-laws) applied to glyphs:
  a symbol alone is as ambiguous as a hue alone.
- **Every icon has an accessible name**, whether or not it shows a visible label.
- **One family, one stroke weight, one grid.** Mixed icon sets read as
  unfinished faster than almost anything else.
- Sizes align to the 4px rhythm: **16px** in dense rows and inline with text,
  **20px** in controls, **24px** in the rail and top bar.
- Icons take semantic color only when the state matrix already calls for it. A
  decorative colored icon spends a hue the system needs for meaning.

## State matrix

Every interactive element implements the first six. Elements representing work,
derived content, or agentic output implement the rest as well.

| State | Meaning | Required cues |
| --- | --- | --- |
| **Idle** | At rest, available | Neutral boundary, no fill |
| **Hover** | Pointer is over it | A border or background shift only — never a change in size or position |
| **Focus** | Keyboard focus | `focus-ring`: 2px `--color-interactive-normal`, 2px offset. Always visible, never suppressed |
| **Selected** | This is the current object | `--color-active-emphasized` on the control, label, or marker; persistent; distinguishable from hover with color removed |
| **Active** | Being pressed right now | Momentary feedback at `--motion-micro` |
| **Disabled** | Unavailable | Reduced contrast **plus a reason** on hover or focus. Never a silently dead control |
| **Pending** | Queued, not started | Copy naming the queue position or wait. No motion |
| **Resolving** | Working now | `--color-active-normal` + progress + copy naming the current stage |
| **Applied** | Committed and in effect | `--color-success-normal` + icon + copy |
| **Failed** | Did not complete | `--color-danger-normal` + icon + copy + a recovery action |
| **Needs review** | Waiting on human judgment | `--color-attention-normal` + icon + copy + an explicit review affordance |
| **Stale** | Its source moved underneath it | `--color-attention-normal` + copy naming what changed + a refresh path |

Dense grids and editors combine several of these cues at once — outline,
background, handle, row or column highlight, label, and the inspector title —
because in a grid a single cue is lost among its neighbours.

## State laws

- **Color never carries a state alone.** Every row above pairs a hue with copy,
  an icon, a boundary, or a position. Remove color from any screen and every
  state must still be readable.
- **Every state has a name a user could say out loud.** If the only way to
  describe a condition is "the greyed-out one with the dot", it is not a state
  yet — it is a visual accident.
- **Disabled explains itself.** A control that cannot be used says what would
  make it usable. This is the most common failure in dense interfaces and the
  cheapest to fix.
- **Failure offers a way forward.** `--color-danger-normal` without a recovery
  action is an accusation, not a state.
- **Needs review is not a warning.** Amber here means the system did its part and
  is now deferring to a person. The copy should read as a handoff, not an error.
- **Stale is honest, not alarming.** A live value whose source moved is not
  broken; it is out of date, and it says so while still showing its last known
  value and when that value was true.
- **Applied is reversible, or it says why not.** The moment a change becomes
  permanent is the moment a user most needs to know it.
