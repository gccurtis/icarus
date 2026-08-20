# Used by

| View | What it is for | Sections |
| --- | --- | --- |
| Used by | What depends on this Context | Personas · Prompt blocks |

Everything here is a reason not to change the scope carelessly. It is also why
Delete is disabled.

## Layout

| 300px |
| --- |
| personas |
| prompt blocks |

## Personas

Agents whose "what it can look up" is this Context.

**Shows** — *Grid Analyst* — What it can look up

**Needs** — `Persona` records referencing this `ResourceSet`.

## Prompt blocks

Generated blocks scoped to it.

**Shows** — *Q3 Resilience Memo · page 2*

**Needs** — prompt blocks referencing this `ResourceSet`.

**Open** — only consumers the backend can query truthfully are listed. There is no
universal reverse index of everything using a Context, so this view is incomplete
by construction and has to say so — which is also why deleting a Context stays
gated.
