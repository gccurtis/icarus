# A resource

| Selecting | What it is | Sections |
| --- | --- | --- |
| Any resource row — a document, deck, spreadsheet, finding, Context or template | The thing itself: what it is, who is in it, where it came from, what it touches | Identity · Editing now · Provenance · Relationships · Actions |

The general lens for a first-class thing in the project. Kind-specific detail
belongs to the screen that owns the kind; this one is about identity and
relationships.

## Layout

| 300px |
| --- |
| identity |
| identity |
| editing now |
| provenance |
| relationships |
| actions |

## Identity

**Shows**

| | |
| --- | --- |
| Title | Q3 Resilience Memo |
| Kind | Document |
| ID | `d_7fk2…9aq` |

with **Open** and **Duplicate** underneath.

**Needs** — the resource record and a resolver from kind to an opening route.

**Open** — whether the raw ID belongs in the panel at all, or only behind a copy
affordance.

## Editing now

Who has it open right now, as avatars that open that person.

**Shows** — two avatars, named on hover, with one line naming them in text.

**Needs** — presence scoped to a resource.

## Provenance

Where it came from. Starts collapsed.

**Shows**

| | |
| --- | --- |
| Created by | Ana Reyes |
| Updated by | Ana Reyes |
| From template | Regulatory filing shell |
| Updated | 4 minutes ago |

**Needs** — creator and updater actors, and a template origin where one exists.

**Open** — not every kind stores an updating actor. *Updated by* falls back to the
latest attributable Activity, then to an em dash, and must never guess.

## Relationships

What this resource is connected to. Starts collapsed.

**Shows** — *Linked question · Why did Feeder 12 fail twice?*, *Cited by · Board Update — October*

**Needs** — a link query in both directions. Research links exist; citation links
between ordinary resources do not.

**Open** — "cited by" implies a reverse index that is not modeled.

## Actions

Starts collapsed. **Open**, **Duplicate**, **Delete**.

**Open** — deletion of a Context, Persona or Automation is gated on
reverse-dependency queries. The same gate should apply to anything a Context can
name.
