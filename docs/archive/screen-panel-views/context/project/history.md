# History

| View | What it is for | Sections |
| --- | --- | --- |
| History | What has happened here, with what was addressed to you first | Search · Addressed to you · When · Today · Yesterday · Earlier |

One panel, because Mentions and Activity answer one question asked in one breath
— *what have I missed*. Split across two views, finding out whether anything
needs you means checking two places, and the same edit gets described twice.

On Project Overview's rail, where it is the one view that holds the past.

## Data

| Source | Kind | Provides |
| --- | --- | --- |
| `capabilities.project.activity` | Capability | an `ActivityEntry` per event: actor, verb, subject, time, and which day it falls on |
| `capabilities.collaboration.mentionsForViewer` | Capability | a `PersonComment` per mention: author, resource, excerpt, age, resolved |
| `PEOPLE` · `AGENTS` | Model | which of the three kinds of actor a recorded name is |

The project is not among them. It is read from `/app/[project]` once and carried
on the client model, so a panel that took it would be offering a second answer to
a question already settled.

## Layout

| Label | Components |
| --- | --- |
| search | `PanelSearch` |
| addressed to you | `PanelSection` |
| when | `PanelChoice` |
| today | `PanelSection` |
| yesterday | `PanelSection` |
| earlier | `PanelSection` |

The search is above everything and narrows both halves at once. The day filter
sits between them because it applies to the record only — a mention is dated by
when it was written, and nobody looks for one by which day that was.

A day with no events has no section at all, rather than an empty one.

## Search

The field, and what it narrows.

**Example** — placeholder "Search history", "9 of 41", "Nothing here matches."

**Nests** — addressed to you, when, today, yesterday, earlier

### Structure

- `PanelSearch` `flush` — the field, its matched-of-total count, and its own
  nothing-matches sentence, wrapping every band below it

### Props

`placeholder`, `matched`, `total`, `empty`, `value`. The count is both halves
added together: one search over one panel gives one number.

### Behavior

Narrows mentions by resource and excerpt, and events by actor, verb and subject.

## Addressed to you

What a person said with your name in it, above the record rather than filtered
out of it.

**Example** — "Mira Jain on Q3 Resilience Memo" — "@ana can you confirm 1,842,000
against the relay log?" — 2h · [ ] Include resolved

### Structure

- `PanelSection` `open` `flush` — titled *Addressed to you*, with a count
  - `PanelToggle` — **Include resolved**, at the head of the section
  - `PanelRow` ×n — one per mention

### Props

Each row takes `title` "*author* on *resource*", `sub` the excerpt, `meta` the
age — prefixed `resolved ·` where it is — and `onselect`.

### Behavior

**Addressed to you is a band, not a filter.** It is above the record rather than
a chip over it, because the whole reason it is separate is that it does not
compete with the record for attention — it wins.

**Resolved is excluded by default.** A resolved comment is a thing that happened,
so it stays in the record below; it is not a thing that needs you, so it leaves
this band unless asked for.

Selecting opens [the comment](../../inspector/collaboration/comment.md).

## When

Three days and an Any time, over the record below.

**Example** — `Any time` `Today` `Yesterday` `Earlier`, with Any time on

### Structure

- `PanelChoice` — one of a small set, shown rather than hidden

### Behavior

Choosing a day leaves only that day's section standing. It does not narrow the
band above it.

## Today

What has happened today, newest first.

**Example** — **Ana Reyes** *changed* **Q3 Resilience Memo** — 09:41

**Nests** — nothing; *Yesterday* and *Earlier* are siblings with the same shape

### Structure

- `PanelSection` `open` `flush` — titled *Today*, with a count
  - `PanelRow` ×n — each holding two `PanelLink`s rather than being one button

### Props

Each row takes `meta` the time. The title is composed as *actor verb subject*,
with the actor and the subject as links inside it.

### Behavior

**The row is not a button: it holds two.** The actor is the way to who did it and
the subject is the way to the event itself, and a single click target would make
one of those unreachable.

An actor is resolved by name against people, then agents, then connectors — so
"SharePoint — Ops Reports" opens
[the connector](../../inspector/project/connector.md), a person opens
[their profile](../../inspector/collaboration/person.md), and an agent opens
[its persona](../../inspector/agents/persona.md). The subject opens
[the event](../../inspector/project/activity.md).

Only *Today* is open on arrival. Yesterday and Earlier are closed, because the
record is read backwards from now and everything before today is already past.
