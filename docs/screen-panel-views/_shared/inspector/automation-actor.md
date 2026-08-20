# An Automation, as an actor

| Selecting | What it is | Sections |
| --- | --- | --- |
| An Automation named as "who did this" | The standing rule that caused the thing you are looking at | Automation · Last fired · Why it shows as an actor · Actions |

Work an Automation starts is attributed to it, so a row can read "updated by
Nightly filing digest". This lens explains that attribution and gets you to the
rule.

## Layout

| 300px |
| --- |
| automation |
| automation |
| last fired |
| why it shows as an actor |
| actions |

## Automation

Name and what the rule says, as a sentence rather than a trigger/action pair.

**Shows** — **When** the clock reaches 02:00 in New York, **ask Filing Editor** to
summarise last night's reports.

**Needs** — `Automation` name, trigger and action, and a renderer that turns the
pair into one sentence. The same renderer serves the Automations screen.

## Last fired

The one fact there is. A dispatch either started a task or could not.

**Shows** — `When · Today, 02:00`, `Result · Couldn't start`

**Needs** — last-fire timestamp and outcome on `Automation`.

**Open** — there is no run table, so this is the whole history. Nothing here may
imply a timeline.

## Why it shows as an actor

Attribution names the rule, not the person who wrote it. The dispatching user
stays in the detail rather than taking the label.

**Needs** — nothing.

## Actions

**Open rule** goes to the Automations screen with this one selected.
