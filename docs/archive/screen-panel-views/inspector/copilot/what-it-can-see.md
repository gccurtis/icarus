# What the Copilot can see

| Selecting | What it is | Sections |
| --- | --- | --- |
| The Copilot's scope control | Everything this request will be able to look up, and where each part came from | Suggested · Saved Contexts · The agent's own · Altogether |

Assembled from three places — what the screen offers, what you pick, and what the
agent always has. The panel keeps them apart because they are revoked in three
different ways.

## Layout

| 300px |
| --- |
| suggested |
| search |
| saved contexts |
| saved contexts |
| the agent's own |
| altogether |
| footer |

## Suggested

What the screen you are on can offer: the current selection, the resource you are
in. Suggested is not attached. Nothing is in scope until you say so, and the row
says that.

**Shows** — *This selection · 38 characters*, *Q3 Resilience Memo — the document you are in*

**Needs** — the active screen's own idea of what it can contribute. Each screen
supplies this; the Copilot does not guess.

## Saved Contexts

The project's saved scopes, selectable for this request.

**Shows** — *Field reports 2024–25 · 96*, *Regulatory corpus · 34*, *Storm
precedents · matches nothing — blocked*

**Needs** — `ResourceSet` records with a live resolved count.

**Open** — a zero-member Context currently broadens retrieval to the whole
project, so it is blocked here rather than offered. This stays until an
explicit-empty scope is distinguishable from an absent one.

## The agent's own

What the persona always has, marked as not switchable. Changing it means editing
the Persona, not switching part of it off for one turn.

**Shows** — *Field reports 2024–25 — Grid Analyst always has this · 96*

**Needs** — the persona's own scope, and a way to render it as fixed rather than
as an unchecked option.

## Altogether

The total, and the one thing that is never a part of it.

**Shows** — `Can look up · 96 resources`, `Membership · Always enforced, never one of the parts`

**Needs** — a resolved union count, with project membership applied after it
rather than as a term in it.

**Open** — these choices are draft state only. `Message`, `PersonaChat` and
`AgentTask` carry no request-level scope or attachment list, so reopening an old
turn cannot show what it could see at the time.

## Panel furniture

A search over project resources, sitting between Suggested and Saved Contexts —
it adds a one-off resource to this request without saving a Context for it.

**Back** returns to the Copilot's home lens; **Done** closes the scope panel and
returns to the composer. Both are pinned at the foot, because the list above them
scrolls.

**Open** — a one-off resource added by search is exactly the request-level
attachment the model cannot store. It survives until the message is sent and then
has nowhere to live.
