# A comment

| Selecting | What it is | Sections |
| --- | --- | --- |
| A comment — in a Comments view, a gutter marker, or a person's profile | One thread: what was said, what it is attached to, and the replies | Actions · Thread · Comment · Anchored to · Replies |

One lens for every comment, wherever it was reached and whatever it is attached
to. A document comment, a slide comment and a cell comment are the same thread
with the same states and the same two things you can do to it; only the anchor
differs, and an anchor is a section rather than a lens.

**The anchor is always shown.** The per-editor versions of this left it out on the
grounds that the breadcrumb already said where you were — true when the comment
was reached from the resource it sits on, and false the moment one is reached
from [a person's profile](person.md), where the trail names the person instead.
A thread that cannot say what it is about is not a thread.

## Data

| Source | Kind | Provides |
| --- | --- | --- |
| `view.selection` | Model | which comment is inspected |
| `capabilities.comments.thread` | Capability | the root comment, its replies, the thread's state, and each author |
| `capabilities.comments.anchor` | Capability | the anchor resolved against the resource as it is now |
| `capabilities.comments.reply` | Capability | writes a reply onto the thread |
| `capabilities.comments.resolve` | Capability | moves the thread between open and resolved |

## Layout

| Label | Components |
| --- | --- |
| actions | `PanelButton` ×2 |
| | `Separator` |
| thread | `PanelFields` |
| comment | `PanelQuote` |
| anchored to | `PanelSection` |
| replies | `PanelSection` |

The two controls are at the top rather than under the replies, because a thread
is unbounded — a Reply button below fifty replies is a button nobody reaches. The
rule that put the accept at the foot of
[the create-variable form](../../context/project/variables-create.md) gives the opposite
answer here, and for the same reason: that body is three fields and this one has
no ceiling.

## Actions

The two things you can do to a thread.

**Example** — **Reply** · **Resolve**

### Structure

- `PanelButton` `tone="primary"` — **Reply**
- `PanelButton` — **Resolve**, reading **Reopen** when the thread is resolved
- `Separator` — under the pair

### Props

`label` and `onclick` each. The second's label is derived from thread state
rather than being a fixed word beside a state chip that contradicts it.

### Behavior

Reply focuses a composer at the foot of the replies and scrolls it into view —
the button is at the top because it must be findable; the writing happens where
the thread ends.

Resolve settles the thread and leaves it in place. It does not close the lens: a
person resolving something usually wants to see that it took, and a panel that
vanished on the press would look like a deletion.

## Thread

Its state, whether it concerns you, and who started it.

**Example** — Open · Mentions you · Started by Mira Jain · 2 hours ago

### Structure

- `PanelFields` — state, mention, author and time
  - `PanelChip` — `Open` or `Resolved`, and `Mentions you` where it does
  - `PanelActor` `size="row"` — the author, opening [their profile](person.md)

### Props

The state chip is `tone="active"` open and `tone="inactive"` resolved. *Mentions
you* is `tone="attention"` and absent rather than negated when it does not.
`PanelActor` takes `name`, `kind="person"`, `src` and `onselect`.

### Behavior

Resolved is stated in words as well as colour, so the thread's state survives the
panel being read without it.

## Comment

The first message, in full. Never truncated: this is the thing the lens is about,
and a thread whose opening line is clipped makes the reader open the resource to
find out what was asked.

**Example** — "@ana can you confirm 1,842,000 against the relay log? The event
log says 1,840,200."

### Structure

- `PanelQuote` — the body, with the author as its source

### Props

`source` the author's name, `sourceLabel` omitted — a name under a quotation
plainly is its source. `onopen` is absent here, because *Anchored to* below is
the way to the original.

## Anchored to

What the thread is about: the resource, the place inside it, and the text where
there is any.

**Example** — *Q3 Resilience Memo* · "nearly a third of customer-minutes lost" ·
or *Outage Cost Model* · C2 · or *Board Update* · Slide 4

### Structure

- `PanelSection` — titled *Anchored to*, open on arrival
  - `PanelRow` — the resource and the location inside it, opening both
  - `PanelQuote` — the anchored text, on a text anchor only. A cell address and a
    slide number are the location, not a quotation of one

### Props

`PanelRow` takes `title` the resource name, `sub` the location — `C2`, `Slide 4`,
or absent for a whole-resource anchor — and `onselect`. `PanelQuote` takes the
resolved text and `onopen`, which lands on it rather than on the resource's top.

### Behavior

Selecting opens the resource at the anchor, in a tab, adopting one that is
already open on it.

An anchor whose text has changed says so and quotes what is there now beside what
was written; one whose text is gone says that, and offers the position without
pretending to the words. Silently showing whatever currently sits at that offset
is the one thing this section must not do — it would attribute a remark to a
sentence nobody was talking about.

## Replies

The rest of the conversation, oldest first, and where a new one is written.

**Example** — Ana Reyes · "Checking against the relay log." — 1h

### Structure

- `PanelSection` `flush` — titled *Replies*, with a count, open on arrival
  - `PanelRow` — one per reply: who, what they said, how long ago
  - `PanelEditableText` `multiline` — the composer, at the foot of the list

### Props

Each `PanelRow` takes `title` the author, `sub` the reply, `meta` the age, and
`onselect` opening that author. The composer takes `value`, `onchange` and a
placeholder; sending is the Reply button above, so there is one send rather than
two.

### Behavior

Oldest first, because a thread is read as a conversation rather than scanned as a
feed — the newest reply is at the bottom, next to where the next one gets
written.

Replies do not collapse. A thread long enough to want that is a thread that
should have become a task.
