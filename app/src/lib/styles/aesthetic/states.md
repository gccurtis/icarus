# States

> What every component must be able to report about itself. A component is an
> instrument, and instruments are judged on whether they report their condition
> honestly.

## This is a floor

The matrix below is the minimum a component must be able to say, not the
maximum it is allowed to say. It exists so that a control built quickly is
still honest, and so two components built on different days agree about what
"stale" looks like.

It is not a vocabulary limit. A screen that genuinely needs a condition this
list does not name should express it, well, and then the list should grow. **A
system that prevents its own best work has failed at the only thing it was
for.** What is not negotiable is the laws below the matrix — those are about
honesty, not about expressiveness.

## The matrix

Every interactive element implements the first six. Anything representing work,
derived content, or agentic output implements the rest as well.

Every entry names a role slot, never an intensity.

| State | Meaning | Required cues |
| --- | --- | --- |
| **Idle** | at rest, available | neutral boundary, no fill |
| **Hover** | the pointer is over it | a border or ground shift only — `*-surface-hover` behind content, `*-fill-hover` on a solid. Never a change in size or position |
| **Focus** | keyboard focus | the focus ring, always visible, never suppressed |
| **Selected** | this is the current object | `active-text` on the label, `active-border` on the control; persistent; distinguishable from hover with color removed |
| **Active** | being pressed right now | momentary feedback at `micro` |
| **Disabled** | unavailable | `inactive-text` **plus a reason** on hover or focus. Never a silently dead control |
| **Pending** | queued, not started | copy naming the queue position or wait. No motion |
| **Resolving** | working now | `active-text` + progress + copy naming the current stage |
| **Applied** | committed and in effect | `success-text` + icon + copy |
| **Failed** | did not complete | `danger-text` + icon + copy + a recovery action |
| **Needs review** | waiting on human judgment | `attention-text` + icon + copy + an explicit review affordance |
| **Stale** | its source moved underneath it | `attention-text` + copy naming what changed + a refresh path |

Where a state needs a ground rather than a glyph — a whole row marked stale, a
badge rather than a label — it takes the matching `-surface` slot behind the
content and keeps the `-text` slot on top of it. A state that puts a content
slot behind a surface slot has the ramp backwards.

Dense grids and editors combine several cues at once — outline, ground, handle,
row highlight, label, inspector title — because in a grid a single cue is lost
among its neighbours.

## The laws

- **Color never carries a state alone.** Every row above pairs a hue with copy,
  an icon, a boundary, or a position. Remove color from any screen and every
  state must still be readable.
- **Every state has a name a person could say out loud.** If the only way to
  describe a condition is "the greyed-out one with the dot", it is not a state
  yet — it is a visual accident.
- **Disabled explains itself.** A control that cannot be used says what would
  make it usable. This is the most common failure in dense interfaces and the
  cheapest to fix.
- **Failure offers a way forward.** A danger color with no recovery action is
  an accusation, not a state.
- **Needs review is not a warning.** Amber here means the system did its part
  and is now deferring to a person. The copy reads as a handoff, not an error.
- **Stale is honest, not alarming.** A live value whose source moved is not
  broken; it is out of date, and it says so while still showing its last known
  value and when that value was true.
- **Applied is reversible, or it says why not.** The moment a change becomes
  permanent is the moment a person most needs to know it.
- **Nothing without a provenance is shown.** A derived value whose origin the
  system cannot establish is not a low-confidence result to render with a
  caveat. It is an answer the system does not have, and the honest state is to
  say so — *this could not be traced* — rather than to display the value and
  hedge. See [aesthetic](aesthetic.md).

## One focus language

Focus is a two-pixel outline in the `interactive` boundary color at a
two-pixel offset, applied globally to links, buttons, inputs, selects,
textareas, `summary`, and anything with `tabindex`.

There is exactly one. A component may *also* light its own border on focus, but
it may never replace the ring with a border change, a shadow halo, or a
background shift. An outline sits outside the box, survives `overflow: hidden`,
and is the one focus treatment that forced-colors mode renders correctly — a
box-shadow ring is none of those things.

## Contrast by construction

Contrast is carried by the slot table rather than by case-by-case judgment.
`border` clears 3:1 for non-text UI, `fill` clears 4.5:1 so `on-fill` is legible
on it, and `text` clears 7:1 for small or dense text — in **both** readings,
measured against the planes those slots actually sit on.

**A component that picks the right slot for the job is compliant.** That is the
whole reason a component picks a job rather than an intensity: an intensity can
be chosen wrongly, a job cannot.

Pairings outside the contract — one role's `text` on another role's `fill`, a
content slot on an elevated rather than work plane — are measured before use.
The measured tables are in [celestial](../celestial/celestial.md).

## Hard requirements

- Normal text ≥ 4.5:1; large text and meaningful non-text UI ≥ 3:1.
- Every interactive element has visible keyboard focus, and focus order follows
  visual and task order across tab changes, panel collapse, drawer open and
  close, and overlays.
- Interactive targets ≥ 24×24 CSS px.
- The primary workflow completes without a mouse.
- State never relies on color alone, and reduced-motion preferences are
  respected — see [motion](motion.md).
- Modals trap focus and restore it to the control that opened them. Drawers do
  not trap focus: a drawer is a place to work, not a cage.
- Focusing a panel does not destroy the prior selection. Moving focus to an
  inspector or composer while text is selected keeps that selection visible,
  which is what the selection surface is held for.
- Suppressed scrollbars still scroll, and focused content always scrolls into
  view. A region that cannot satisfy that shows its scrollbar.

## Announce meaning, not increments

Announce stage transitions and completion, not per-item progress. A
long-running task emitting an update per processed item is unusable with a
screen reader; ordinary editing announces nothing.

Truncated meaningful text stays reachable through expansion, resize, a detail
view, or an accessible label. Provenance strings and identifiers are frequently
long, frequently truncated, and exactly the text a person cannot afford to lose.

## Review gates

A screen is not ready when the primary action is unclear; hidden grouping is
unpredictable; focus is invisible or wrongly ordered; keyboard-only use fails on
the primary path; contrast is insufficient or targets are too small; live state
is icon-only or color-only; an error offers no recovery; or the task requires
secret product knowledge.
