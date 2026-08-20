# Thread Demo

Lives at `src/lib/views/thread-demo/thread-demo.md`. Trees live in the concern
document linked below.

## Purpose

A message thread that works, with the panel that supports it, at `/demo/thread`.

Two jobs. It is a working thread — type something, send it, a reply lands after a
short delay and the thread grows. And it is an argument about what a thread has
to carry, made by showing four things a thread cannot do without rather than by
listing them.

## Nothing is running, and the page says so four times

`$messages` exists and defines what a message is — `Message`, `MessageRole`,
`MessageState` and a factory — but nothing in it is callable: its own overview
says a message is written by whichever capability owns the thread, and no thread
table exists to hold one yet. So the replies are four fixed samples served in
rotation from a `setTimeout`, and that is stated in the screen note, in every
sample's own annotation, in the pending indicator's label, and here. Send the same
message twice and you get different samples; send it five times and the first one
comes back.

This is not modesty. A demo page that looked like it was thinking would be lying
about the only thing on it, and every judgment made from it would be a judgment
about a thing that does not exist.

## The four samples, and what each is for

Each sample exists to demonstrate one requirement, and the page names which.

1. **A claim with the passage it rests on.** Two `PanelQuote`s, each carrying its
   source inside the quotation rather than under it, each opening. A citation
   that names a file and cannot open it is a footnote in a product that holds the
   file.
2. **The work behind the claim.** Three calls with what they got, not only that
   they ran. The third found nothing, which is shown as an outcome and not an
   error — on a thin turn it is the only line that explains the turn.
3. **A message that is not finished.** An indeterminate `PanelProgress`, because
   work with no reported extent is *unknown*, which is a state and not zero. It
   then amends itself in place: same message, same id, new body. That single
   behaviour is the widest-reaching requirement on the page.
4. **Something worth keeping.** A proposed finding with accept and dismiss on the
   finding rather than the message, and counts in the panel that move when it is
   decided.

The seeded thread shows samples 1, 2 and 3 on arrival, with the third still
running; it settles six seconds in, so the indeterminate form is visible without
becoming a bar that never ends. Sending starts at sample 4.

## Is a feed a different component?

The question was asked as "a feed is just a selection, really — I guess there's no
difference". Mostly right, and the residue is worth naming precisely.

**Read what is already specified.** `screen-panel-views/project-overview/context/activity.md`
is every event in the project, newest first, as actor-verb-target rows grouped by
day with three filters. `.../mentions.md` is the subset a person addressed to you,
as rows naming the person, where the comment is, and enough of it to decide
whether to open it. Both are lists in time order. Both are already specified as
`PanelRow` inside `PanelSection`, and neither needed a new word to exist.

**So there is no `Feed` component to build**, because the feed was never the
missing piece. A feed is a query plus a row, and the row exists.

Three differences survive inspection.

- **Density, which is not structural.** A feed row is one line because a feed's
  job is triage in a 300px column and a row exists to be decided about; a thread
  message is the thing itself at a reading measure, with its sources, its calls
  and its controls. One record, two renderings — and a single component with a
  `dense` prop would be two disjoint halves sharing a name.
- **Origin, which is a field and not a type.** Every feed row says where it came
  from — "Mira Jain *on Q3 Resilience Memo*" — and no thread message does, because
  in a thread the *where* is the page. One optional property on the record is the
  entire difference in the data.
- **Mutability, which is structural, and is the real answer.** An Activity row is
  an event: "Ana Reyes edited Q3 Resilience Memo — 4m" is finished the moment it
  is written and will never say anything else. A thread message is not finished.
  Sample 3 arrives unfinished and rewrites itself in place; sample 4 carries a
  decision that changes what the message says when you take it. A feed is
  append-only. A thread is append-and-amend — a different data structure, not a
  different stylesheet.

**A feed is a selection you watch; a thread is a container you are in, and the
tell is the composer.** You cannot append to Activity, because there is no *here*
for a new row to belong to. The field at the foot of this page is not furniture.

**What to build, then.** Not `Feed`, and not `Thread` as one component either. A
message *record* — id, time, actor, body, an optional origin, and its parts —
ordered by time; a *row* renderer for triage, which is the `PanelRow` we already
have; and a *turn* renderer for reading, which is what this view's `thread-turn`
is a first draft of. Grouping is a prop over one ordered list: by day for
Activity, by turn for Research. It is not a second component.

## A disagreement this page surfaced

`screen-panel-views/research/workspace-one-question.md` says the Research
workspace is "anchored to one turn, not scrolled through all of them", and
`.../research/context/history.md` exists precisely because of that decision — the
earlier turns had to live somewhere. This page is the other shape: one scrolling
thread.

They are not compatible and both have a case. Anchoring keeps an answer and the
findings it produced readable side by side, which is the judgment the screen is
for, without a wall of scrollback above it. Scrolling makes "what did we establish
three turns ago" answerable without leaving the middle of the screen, and is what
everyone arrives expecting a thread to be.

It should be settled deliberately rather than by whichever gets built first.

## What is missing, and is not a detail

Named on the page as well, because a demo that shows only what works teaches the
wrong thing.

- **Streaming.** Every reply here arrives whole. A reply arriving in pieces is
  the amend-in-place case at a hundred times the rate, and it decides whether a
  message can be rendered once and left alone.
- **Failure.** No sample fails. A reply that errors is a message and belongs in
  the thread beside the question it failed, not in a toast.
- **Editing.** Nothing here can be changed after it is sent. The moment it can,
  every quotation of it has a truth problem.
- **Branching.** History's own note: selecting an earlier turn and asking
  something new has no defined relationship to the turns after it. A thread that
  can be re-entered in the middle is a tree.
- **A read watermark.** Mentions cannot store *unread* today; a thread needs the
  stronger form — not whether you have seen it, but how far down.
- **More than two participants**, and quoting one message inside another.

## The panel vocabulary on the plane

Worth recording because it will come up again. `PanelQuote`, `PanelProgress`,
`PanelNote` and `PanelActions` each carry the panel's 12px gutter, which they were
given for a 300px column. Used in the middle of a workspace they inherit it, and
it happens to read correctly — a quotation indents, a note indents — so nothing
was fought here. The one thing to avoid is nesting them inside another component
that also insets, which doubles the gutter to 24px and turns a note into a
footnote about its neighbour.

## Boundary

This view owns the sample messages, the reply rotation, the accept/dismiss
bookkeeping, and the argument the page makes. It does not own the panel or screen
vocabularies, and it introduces no unique component — every part of a message is
composed from words that already exist.

It deliberately does not use `PanelSkeleton` anywhere the wait is unbounded, and
does not draw a **New thread** control, because a control that can never work
should not be drawn.

## Public Contract

- **Entry:** [`thread-demo.svelte`](thread-demo.svelte)
- **Types:** `None`

| Kind | Name | Type | Required | Purpose |
| --- | --- | --- | --- | --- |
| — | `None` | — | — | The view takes no props; the route renders it directly |

## Dependencies

- `$lib/unique-components/panel` — the message parts and the supporting panel
- `$lib/unique-components/screen` — the plane the thread is set on
- `$lib/simple-components/textarea` — the composer's field

It reads no client model and calls no capability. The messages are an array held
here, and every reply is a literal in this file.

## Concerns

- [`components/`](components/components.md)
