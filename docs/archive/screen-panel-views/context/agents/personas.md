# Personas

| View | What it is for | Sections |
| --- | --- | --- |
| Personas | Every agent available here, by who owns it | Actions · Search · Project · Shared · Personal |

Grouped by scope, because whose an agent is decides who may edit it — and the
three headings are the only place that is said.

On the library rail and the persona rail, because the reason to have it is to get
from one agent to the next.

## Data

| Source | Kind | Provides |
| --- | --- | --- |
| `view.project` | Model | which project the personas are scoped to |
| `capabilities.agents.personasIn` | Capability | a `PersonaRow` per agent: name, scope, and its task counts |

The project is not among them. It is read from `/app/[project]` once and carried
on the client model, so a panel that took it would be offering a second answer to
a question already settled.

## Layout

| Label | Components |
| --- | --- |
| actions | `PanelButton` ×3 |
| search | `PanelSearch` |
| project | `PanelSection` |
| shared | `PanelSection` |
| personal | `PanelSection` |
| | `PanelNote` |

The three sections are always present, empty or not: a scope with no agents in it
is a fact about the project, and a heading that disappeared would make it look
like the scope did not exist.

## Actions

The three things you can do to a persona from a list of them.

**Example** — **New** · **Open** · **Duplicate**

### Structure

- `PanelButton` `tone="primary"` — **New**
- `PanelButton` — **Open**, disabled until something is chosen
- `PanelButton` — **Duplicate**, likewise

### Props

The two disabled buttons carry "Choose a persona first" as their title, so the
reason is on the control rather than inferred from the greying.

### Behavior

**New** inspects a blank persona — `agents.persona` on the id `new` — rather than
opening a dialog: naming an agent is the first line of its definition, not a
question asked in front of it. **Open** inspects the chosen one. **Duplicate**
copies it and inspects the copy; nothing writes a persona back, so the built
button currently repeats **Open** rather than making anything.

**Delete is absent rather than disabled.** Forty-one tasks and six conversations
name a persona, and there is no tombstone policy that would keep those labels
readable after a hard delete — so the panel does not offer a thing it cannot
undo.

## Search

The field, and what it narrows.

**Example** — placeholder "Search personas", "3 of 7"

**Nests** — project, shared, personal

### Structure

- `PanelSearch` `flush` — the field and its matched-of-total count, wrapping the
  three sections

### Behavior

Narrows by name across all three scopes at once. The sections stay: a search is a
question about every agent, and the answer is still owned by somebody.

## Project

The project's own agents.

**Example** — Grid Analyst — "41 tasks · 2 running"

**Nests** — nothing; *Shared* and *Personal* are siblings with the same shape

### Structure

- `PanelSection` `flush` — titled with the scope, with a count
  - `PanelRow` ×n, with a `Bot` icon, `tone="active"` while something is running

### Props

**The row carries what the persona has done, not what it describes.** Two
personas with similar descriptions are told apart by their record, so the count
is the qualifier and the description is left to the profile. Running is left off
at zero, so a quiet persona reads as quiet.

### Behavior

Selecting one opens [its lens](../../inspector/agents/persona.md) and marks it as
the chosen one for **Open** and **Duplicate**.

## Shared

Agents somebody else made available.

**Example** — Filing Editor — "12 tasks"

## Personal

Agents that are yours alone.

**Example** — Skeptic — "3 tasks"

### Structure

- `PanelSection` `flush`, then a `PanelNote` `tone="gap"` under all three

### Behavior

Whether a shared or personal persona may be edited from here is a deployment rule
the model does not carry, so the row cannot say — and the note says that rather
than letting an editable-looking row imply an authority nobody has checked.
