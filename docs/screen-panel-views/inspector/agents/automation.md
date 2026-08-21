# An Automation

| Selecting | What it is | Sections |
| --- | --- | --- |
| An Automation, from the list or as the default lens | The rule: what it says, whether it is on, and what happened last time | This rule · Last fired · Attribution · Removal |

## Layout

| 300px |
| --- |
| this rule |
| this rule |
| this rule |
| last fired |
| attribution |
| removal |

## This rule

Name, the on/off switch, and the rule as a sentence.

**Shows** — `Name · Nightly filing digest`, `On · yes`, then "**When** the clock
reaches 02:00 in New York, **ask Filing Editor** to summarise last night's
reports.", with **Open** and **Run now**

The sentence is the rule. Trigger and action fields are how it is stored; this is
how it is read, and it is the same rendering used everywhere the rule appears.

**Needs** — the `Automation` record and the sentence renderer.

## Last fired

The one piece of history there is.

**Shows** — `When · Today, 02:00`, `Result · Couldn't start`, `Why · Filing Editor
may not use web.search`

**Needs** — last-fire time, outcome and reason.

**Open** — with no run table, this is the entire record. Nothing in the lens may
imply a series.

## Attribution

Starts collapsed.

**Shows** — `Created by · Mira Jain`, `Revision · 4`

**Needs** — creator actor and revision.

## Removal

Turning it off is the safe removal, and the section says so rather than offering
a disabled Delete.

**Open** — hard deletion can break historical actor labels, since past tasks are
attributed to this rule by name. Delete stays gated until a tombstone policy
exists.
