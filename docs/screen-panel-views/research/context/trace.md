# Trace

| View | What it is for | Sections |
| --- | --- | --- |
| Trace | How the answers were arrived at | One section per turn |

The agent's steps, per turn, newest first. It is the answer to "why did it say
that" and to "why did it find nothing".

## Layout

| 300px |
| --- |
| one section per turn |
| one section per turn |
| one section per turn |
| one section per turn |

## One section per turn

Each section is a turn, headed by its time; each row is one tool call with its
outcome and cost.

**Shows**

- **This turn · 10:21** — `lattice.retrieve` — Success · 1.2 s · 4 regions;
  `web.search` — Success · 2.8 s · 2 results
- **10:14** — `lattice.retrieve` — Success · 1.4 s; `resource.read` — Success · 0.3 s
- **10:02** — `lattice.retrieve` — No sufficiently relevant material

A call that found nothing is shown as an outcome, not an error. It is the most
informative row on the screen when a turn produced a weak answer.

**Needs** — tool-call records per turn, with name, outcome, duration and a result
summary.
