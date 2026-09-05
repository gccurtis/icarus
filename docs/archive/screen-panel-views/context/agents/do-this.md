# Do this

| View | What it is for | Sections |
| --- | --- | --- |
| Do this | The two things a rule can do | Ask an agent · Re-run a generated block |

The action half, a chooser like [When](when.md).

## Layout

| 300px |
| --- |
| ask an agent |
| ask an agent |
| re-run a generated block |

## Ask an agent

The common case. Which agent, and what to ask it — the instruction is sent
verbatim.

**Shows** — `Agent · Filing Editor`, `Ask it to · Summarise last night's outage
reports…`, marked **Chosen**

**Needs** — a `Persona` reference and a prompt string.

## Re-run a generated block

Regenerate a prompt block on a schedule rather than waiting for someone to open
the document it is in. Starts collapsed.

**Shows** — *Outage summary* — In Q3 Resilience Memo; *Storm precedent brief* — In
Storm Hardening Options

**Needs** — `DerivedOutput` records with an owning resource.

**Open** — finding the block's owner is a reverse query, because `DerivedOutput`
stores no owner pointer. Without it these rows cannot say where a block lives.
