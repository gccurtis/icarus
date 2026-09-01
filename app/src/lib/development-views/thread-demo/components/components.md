# Thread Demo Components

Lives at `src/lib/development-views/thread-demo/components/components.md`. This is the one
document for the complete recursive component tree.

## Component Tree

```text
thread-demo.svelte
├── thread-turn                      components/thread-turn.svelte
│   ├── turn-tools                   components/turn-tools.svelte
│   └── turn-finding                 components/turn-finding.svelte
├── thread-composer                  components/thread-composer.svelte
└── thread-about                     components/thread-about.svelte
```

`turn-tools` and `turn-finding` are drawn inside `thread-turn`'s body, but the
root passes them — the turn takes a snippet rather than a message, because what a
message carries is the view's business and the frame's job is only who, when and
where the content begins.

## Inventory

<!-- generated:inventory:start -->
- [`thread-about.svelte`](thread-about.svelte)
- [`thread-composer.svelte`](thread-composer.svelte)
- [`thread-turn.svelte`](thread-turn.svelte)
- [`turn-finding.svelte`](turn-finding.svelte)
- [`turn-tools.svelte`](turn-tools.svelte)
<!-- generated:inventory:end -->

## Subtree Contracts

### `thread-turn`

- **Root:** [`thread-turn.svelte`](thread-turn.svelte)
- **Purpose:** the frame of one message — who said it, when, and a rail down the
  left of everything it carries.
- **Inputs:** author, actor kind, clock time, the demo's annotation, and the
  content as a snippet.
- **Outputs:** none. It holds no state and emits nothing.

**Both sides get the same frame.** No bubbles and no alignment flip: a reply here
arrives with a quotation, a list of calls, a bar for work still running and a
decision to take, and a right-aligned bubble hands half the measure back for
nothing. A thread in this application is a document you can add to.

**The rail is load-bearing.** An agent's turn is regularly four blocks tall, and
without a line down its left edge a reader cannot see where one message ends and
the next one's name starts.

**The actor is not a link here.** `PanelActor`'s rule is that a face is always a
way in, with an exception for an actor who is already the subject. Both actors in
a two-party thread are the subject and are repeated on every message; the way in
lives once, in the panel.

### `turn-tools`

- **Root:** [`turn-tools.svelte`](turn-tools.svelte)
- **Purpose:** what the agent ran to produce the message above it, and what came
  back.
- **Inputs:** the calls, each with a name, an outcome, a result in words, and a
  duration.
- **Outputs:** none.

**Under the prose, never over it** — the claim comes before the machinery, which
is the Research specification's ordering.

**A call that found nothing is an outcome, not an error.** Neutral chip, own
sentence. On a thin turn it is the only line that explains the turn, and painting
it red would send someone hunting a fault that is not there.

**Every row says what it got.** A name and a duration are a receipt; "4 regions
across 3 sources" is the half anyone can act on.

### `turn-finding`

- **Root:** [`turn-finding.svelte`](turn-finding.svelte)
- **Purpose:** a conclusion the thread produced, offered for keeping.
- **Inputs:** the title, the claim in full, how it was arrived at, what it stands
  on, and its state.
- **Outputs:** accept, dismiss, and a request to open one of its sources.

**Not a `PanelQuote`, however well the shape fits.** A finding is a conclusion
rather than a quotation, and a quote box would claim a source states it outright
— which the interesting ones never do. `basis` says how it was arrived at instead
of leaving a border to imply it.

**The decision belongs to the finding.** One reply can propose three, and a
per-message control would make a reader take all of them or none.

**A decided finding keeps its place.** The thread is the record of how the
conclusion was reached, and a thread with its decisions edited out cannot answer
why something is in the project.

### `thread-composer`

- **Root:** [`thread-composer.svelte`](thread-composer.svelte)
- **Purpose:** the next message, at the foot of the thread.
- **Inputs:** the draft (bound), whether a reply is outstanding, and the thread's
  scope chips.
- **Outputs:** send.

**This is the component that makes the list a thread.** A feed and a thread are
both messages in time order; only one of them has a *here* for a new message to
belong to.

**`simple-components/textarea`, not a hand-rolled field.** The focus ring, the
disabled treatment and `field-sizing: content` are already there, and the height
following the text is the behaviour people notice the instant it is missing.

**Enter sends, Shift-Enter is a newline, and composition is guarded.** For anyone
typing through an IME, Enter commits a candidate word — a composer that read that
as a send would fire a half-written message on nearly every line.

**The send control is `ScreenAction`.** A composer is on the plane, so
`PanelButton`'s 24px would read as a panel control that had wandered out. It is
the one thing this screen makes, so the header has no `ScreenAction`.

### `thread-about`

- **Root:** [`thread-about.svelte`](thread-about.svelte)
- **Purpose:** what the thread is about, beside the thread — the shape Research
  specifies.
- **Inputs:** the title, message count, finding counts, distinct sources, the
  newest turn's sources, and whether a reply is outstanding.
- **Outputs:** rename, clear the thread, and a request to open something.

**The counts are live and that is why they are here.** Accepting a finding in the
middle of the plane moves *Accepted* in the panel, which is what says a decision
went somewhere rather than dimming a button.

**`PanelSkeleton` only where the wait is bounded.** Its own rule is that a
skeleton which never resolves is the worst loading state there is, so it appears
for the incoming turn's sources and nowhere else.

**No New thread button**, though the specification's panel has one: a control
that can never work should not be drawn, and this page has one thread.
