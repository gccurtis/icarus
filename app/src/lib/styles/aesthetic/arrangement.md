# Arrangement

> How things are placed, divided, and revealed. Placement is not a delivery
> detail for a decision made elsewhere; **it is half the decision.**

## The right things, in the right place

"Few things visible, the right things visible" is only half a law. A correct
set of controls in an arbitrary arrangement is not a correct screen — the
person still has to work out what goes with what, which is the labour the
screen was supposed to remove.

Three things carry as much weight as the selection itself:

- **Where.** A control acting on the selection belongs beside the selection. A
  control acting on the whole document belongs where the document's identity
  is. Putting the second one next to the first teaches a person a relationship
  that is not true.
- **In what order.** Sequence is an argument. Things read top to bottom and
  left to right, and a reader takes that order as a claim about precedence,
  dependency, or time. An order chosen by when the code was written makes a
  claim nobody meant.
- **In what grouping.** Every group is an assertion that its members belong
  together, and it should be one you could defend out loud: steps in one
  sequence, facets of one object, alternatives to one decision. A group
  assembled because the items were adjacent in the data is a group the reader
  has to disassemble before they can use it.

## Distinction is communication

A change of ground, a rule, a divider, a plane — each is a sentence saying
*this is a different kind of thing*. They are not neutral texture, and treating
them as texture is why dense screens go flat.

Spend them deliberately and a dense screen explains itself before it is read.
Withhold them and every region has to be parsed. The failure is usually
under-spending, not over: one continuous surface holding six kinds of content
tells a person nothing, and the fix is almost never more space.

The corollary is that a distinction should never be drawn where there is no
difference. A rule between two things of the same kind reads as a claim that
they differ, and the reader will spend real effort looking for how.

## Seams, not boxes

The default instinct is to draw a box around anything that belongs together. A
screen built that way accumulates borders: every card has four, every neighbour
pair has two where one would do, and every corner radius has to negotiate with
the one beside it.

The alternative is a **seam**. Lay a set of cells on one ground, give the
container the seam color, and let a one-pixel gap between cells be the line.
Neighbours share a single hairline, the outer edge is one border and one radius,
and the whole group reads as one object with internal structure rather than a
pile of separate objects.

This is what makes a dense screen look composed rather than assembled. It is
also cheaper to hold in the head: a person parses one region with parts, not
nine regions in a row.

Boxes are still right for things that genuinely float — a popover, a dialog, a
block lifted off its plane. On-plane structure takes seams.

## One grid, nothing hidden

Regions that sit side by side share one track template and one row height. A
folder or a group opens **in place**, on the same grid, rather than replacing
the view or opening somewhere else. Controls that appear on more than one region
are extracted and shared rather than re-implemented at each site.

The reason is spatial memory. If a person learned where something is, it should
still be there after they expand something else. Layouts that reflow on
disclosure teach people not to trust what they have learned.

## The accent rail

A block that is *about* something else — a callout, a quoted source, a decision,
an annotation — takes a rail on its leading edge and squares the corners on that
side: 3px of role color, radius on the other three corners only.

The asymmetry is the point. A rail says *this is attached to the flow beside
it*; a symmetric bordered card says *this is a separate object*. Getting that
wrong is the most common reason an annotated document looks like a form.

## Tables

A table is the densest distinction problem in the product, so its conventions
are fixed rather than left to each site.

- **The header row takes its own ground.** Not a heavier rule, not just caps —
  a different plane. The header is a different kind of thing from the data, and
  it should be legible as one before a single word is read.
- **The first column is the key, and it is left-aligned.** It is what the row
  *is*; everything after it is what the row *has*.
- **A rule separates the key column from the rest.** One vertical seam, at the
  one place in a table where the kind of content actually changes.
- **Everything after the first column is centred**, and numeric columns use
  tabular figures so they compare down the column without being read.

That is the default. A table with one long free-text column is the obvious
exception, and taking it is fine — the point of writing the default down is
that departing from it becomes a decision instead of an accident.

## Density

Three control heights, all on the four-pixel grid, because a screen has three
kinds of room.

| Height | Where |
| --- | --- |
| `compact` — 28px | inspector rows, dense grids, chips |
| base — 32px | the default: forms, toolbars, panel controls |
| `roomy` — 40px | primary actions, empty states, anything with space around it |

Every interactive target still clears 24×24 CSS pixels. A control that is
smaller than `compact` is not dense, it is a miss waiting to happen.

Within one region, one height. Mixed heights in a row is the fastest way to make
a considered panel look unfinished, and it is almost always an accident of two
components being written on different days.

## Alignment

Left, and one axis per region. A centred column is for reading; a working
surface is scanned down its left edge, and every element that starts somewhere
else costs a saccade.

Numbers are the exception: they align right and use tabular figures, so a column
can be compared without being read.

## The disclosure ladder

Five rungs. Common actions live within **one hidden layer at most**; rare
actions never require a maze.

1. **Always visible** — primary task actions, current selection, critical
   state, create and open, the entry point for derived work.
2. **Context or inspector** — what acts on the active resource or the selected
   object.
3. **Dropdown or popover** — named secondary groups: Insert, Arrange, Share,
   Export, Review.
4. **Drawer, detail view, or modal** — object detail, comparison, complex
   configuration, consequential confirmation.
5. **Advanced settings** — rare, specialized, or dangerous.

Rung four splits by intent: a **drawer** is a place to work beside what you were
doing; a **modal** is an interruption that must earn itself.

## The grouping test

Hide a set of controls only when all three hold:

1. Its parent label is predictable **before** opening it.
2. It is not required for the primary path.
3. The controls share one coherent abstraction.

"Arrange", "Review changes", and "Prompt settings" pass. "Misc", an unlabeled
kebab covering common work, and an unpredictable icon drawer fail.

## Visible paths

Each of these needs a discoverable route operable by mouse and keyboard, and
none may live only behind a shortcut, gesture, slash command, or right-click:
create, open, and inspect the primary objects; search across everything in
scope; inspect the current selection and change its properties; coordinate work
spanning more than one object; insert and inspect live objects; inspect the
provenance of derived content; refresh, detach, or revert a live binding; review
derived and agentic changes; recover from a mistake; see current state and sync
status.

Accelerators accelerate these paths. **A path that exists only as an accelerator
does not exist for most people.**

## Progressive depth

Depth is the point of a system like this. The rule is not to hide it but to
order it: the default view answers the common question; one step reaches the
supporting material; full lineage is always reachable and never mandatory.

Depth that cannot be skipped is not depth. It is friction.

## Tokens this justifies

| Token | Job |
| --- | --- |
| `--token-spacing-unit` | the four-pixel grid everything multiplies |
| `--token-control-height-compact`, base, `-roomy` | the three densities |
| `--token-hairline` | the seam width |
| `--token-rail` | the accent rail on an attached block |
| `--token-radius-control`, `-panel`, `-overlay` | corners by what the thing is |
| `--token-measure-*` | line length, shared with [type](type.md) |

The recipes that compose these — the seam grid, the attached block, the veil,
the table conventions — are in [surfaces](../surfaces/surfaces.md), so that a
screen reaches for a named arrangement rather than re-deriving one.
