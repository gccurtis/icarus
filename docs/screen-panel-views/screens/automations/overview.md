# Automations — panels

Standing one-trigger, one-action rules, read as a sentence: **when** something
happens, **do** one other thing. Two triggers means two rules.

Two subscreens: **all automations** and **one rule**. The rail is the same in
both.

## Context panel

| View | What it is for | Sections |
| --- | --- | --- |
| [Overview](../../context/overview/automations.md) | What an Automation is, what this project has, what is selected | Automations · In this project · Selected · Actions |
| [Automations](../../context/agents/automations.md) | Every rule, by state | Not working · On · Off |
| [When](../../context/agents/when.md) | The five things that can start a rule | On a schedule · Something changes · A connector syncs · A finding is accepted · Only when I say |
| [Do this](../../context/agents/do-this.md) | The two things a rule can do | Ask an agent · Re-run a generated block |
| [Health](../../context/agents/health.md) | What is broken, what has never run, what works | Not working · Never fired · Working |

When and Do this are the rule's two halves, as two rail entries. A rule has
exactly one of each, so each view is a chooser with the current choice marked.

## Inspector panel

| Selecting | What it is | File |
| --- | --- | --- |
| An Automation | The rule: its sentence, its switch, its last fire | [automation.md](../../inspector/agents/automation.md) |
| A schedule trigger | When it fires, and when it fires next | [schedule-trigger.md](../../inspector/agents/schedule-trigger.md) |
| An "ask an agent" action | Who is asked, what they are asked, and what comes out | [agent-action.md](../../inspector/agents/agent-action.md) |
| A "re-run a block" action | Which block, and what re-running it means | [refresh-action.md](../../inspector/agents/refresh-action.md) |
| The last fire | What happened the one time there is a record of | [last-fired.md](../../inspector/agents/last-fired.md) |
| The task a fire started | What was asked, and where it has got to | [task.md](../../inspector/copilot/task.md) |
| A person, or any "who" link | Their profile in this project | [person.md](../../inspector/collaboration/person.md) |

## Workspace

| State | What is in the centre | File |
| --- | --- | --- |
| All automations | Every rule, as sentences you can scan | [workspace-library.md](workspace-library.md) |
| One rule | The sentence, then a column per half of it | [workspace-rule.md](workspace-rule.md) |

## The rules this screen keeps

**A fire is a dispatch.** Success means the task was created, not that it
finished — so the word is **Started**, and a later failure never rewrites that
line.

**An Automation is never itself "running".** The task it made is running.

**Trigger and action names say what happens**, not what the model calls it: "A
finding is accepted", not `finding.accepted`.

**Cron is behind Advanced.** "02:00 daily, New York" is what the rule means;
`0 2 * * *` is how it is stored.

**Duplicating one leaves it off**, so a copy cannot fire before it has been read.

## The gap that shapes this screen

There is no run table, no retry model and no history beyond the last fire. Every
view here is built to be honest about that: nothing shows a timeline, and the
fire count is approximate and labelled as such.
