# A person

| Selecting | What it is | Sections |
| --- | --- | --- |
| A person — their avatar, their name in a table, any "who" link | Their profile inside this project: who they are, what they have said, and what they have done | Person · Comments · Activity |

Hovering an avatar names them. Clicking opens this. It is a project profile, not
an account page: everything here is scoped to the project you are in, and the
panel says so where it matters.

**There is nowhere here to write to them.** A comment belongs on the thing it is
about — you reach a person by mentioning them on the memo, the cell or the slide,
where the remark has a subject and everyone who needs it can see it. A composer
under someone's name would be a private channel in a project that has none.

## Data

| Source | Kind | Provides |
| --- | --- | --- |
| `tab.viewState.selection` | Model | which person is inspected — the id the whole panel reads against |
| `capabilities.people.member` | Capability | the `User`, and their membership in this project: role, joined date |
| `capabilities.presence.forPerson` | Capability | whether they are here now, and what they are in |
| `capabilities.comments.byActor` | Capability | their comments in this project, each flagged for whether it mentions the viewer and whether its thread is resolved |
| `capabilities.activity.byActor` | Capability | what they have done in this project, newest first |

## Layout

| Label | Components |
| --- | --- |
| person | `PanelActor` + `PanelFields` |
| comments | `PanelSection` |
| activity | `PanelSection` |

The first band has no heading — the panel's title already names the person. The
other two are `PanelSection`s, because each is a different subject and one of
them starts shut.

## Person

Who they are, and whether they are here. The head of the lens, so it carries the
picture rather than a row-sized face.

**Example** — Mira Jain, Owner · here now, in Outage Cost Model ·
mira.jain@northwind.example · member since 12 Mar 2026

### Structure

- `PanelActor` `size="head"` — picture and name, with no `onselect`: this actor is
  the subject of the panel and cannot be navigated to from inside itself
- `PanelFields` — presence, email, role and joined date

### Props

`PanelActor` takes `name`, `kind="person"`, `src`, and `role` reading
`Owner · here now, in Outage Cost Model`. Each `PanelField` takes `label` and a
value; the email is `mono`.

### Behavior

Presence is live and says what they are in, which is a link to that resource.
When they are not here the line reads their role alone rather than a last-seen
time — a timestamp in a presence slot is a different claim wearing presence's
clothes.

The role is stated and not editable. Membership is changed in project settings,
and a 300px panel is not where someone is promoted or removed.

## Comments

What they have said in this project, and two ways to narrow it. Open on arrival:
it is the reason to open a person.

**Example** — `All` `Mentions of you` · Hide resolved ● · *Q3 Resilience Memo* —
"@ana can you confirm 1,842,000…" — 2h · *Outage Cost Model, C2* — "@ana
corrected total or the old one?" — 1d

### Structure

- `PanelSection` `flush` — titled *Comments*, with a count, open on arrival
  - `PanelChoice` — All · Mentions of you, at the head of the section
  - `PanelToggle` — **Hide resolved**, beneath the choice
  - `PanelRow` — one per comment: where it is, a fragment of it, and how long ago

**Two controls, because two axes.** Which comments — all of theirs, or the ones
addressed to you — is a choice between alternatives. Whether a settled thread is
still worth showing is an independent yes or no that applies to either. Folding
them into one row of chips would offer *Mentions of you* and *Resolved* as though
picking both meant something, and the control could not say what.

### Props

`PanelSection` takes `title`, `count` and `open`. The count is matched-of-total
whenever either filter is on — `"6 of 24"` — so a narrowed list never reads as
everything they have said. `PanelChoice` takes `label` "Show" and two options.
`PanelToggle` takes `label` and `checked`, on by default: a resolved thread is a
finished conversation, and a profile is for what is still live.

Each `PanelRow` takes `title` the resource and location, `sub` the excerpt, `meta`
the age, and `onselect`.

### Behavior

Selecting a row opens [the comment lens](comment.md) rather than the resource
itself. The thread is what you came for; the resource is one click further, from
that lens's own *Anchored to*.

With **Hide resolved** off, a resolved row is marked as resolved rather than
merely admitted, so the two states are told apart without opening either.

## Activity

What they have done in this project. Starts collapsed — it is context, not the
reason the panel was opened.

**Example** — Created *Outage minutes by substation* — 3d · Edited *Regulatory
filing shell* — 2w

### Structure

- `PanelSection` `flush` `open={false}` — titled *Activity*
  - `PanelRow` — one per entry: what they did, to what, and when

### Props

`title` the verb and object, `meta` the age, `onselect` opening the thing. No
`icon`: a column of identical person icons under a person's own panel says
nothing.

### Behavior

Selecting a row opens what was acted on. Commenting is not repeated here — it is
the section above, and an activity feed that also carried comments would be the
same rows twice.
