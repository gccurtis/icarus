# Automations — all automations

| Workspace | What it is for | Regions |
| --- | --- | --- |
| The default state | Every rule, as sentences you can scan | Header · Filters · Automations · Note |

## Layout

| 1fr |
| --- |
| header |
| filters |
| automations |
| automations |
| note |

## Header

**Shows** — "Automations" over "A run is a dispatch. Success means the task was
created — what it then does is the task's own story.", and **New Automation**

**Needs** — the create route. The subtitle defines the word the whole screen turns
on.

## Filters

**Shows** — a search, then `All` · `On` · `Off` · `Not working`

**Needs** — the automation query to accept a search and a state.

## Automations

A table whose columns read as a sentence left to right: switch, name, when, do
this, last fired, result.

**Shows**

| On | Name | When | Do this | Last fired | Result |
| --- | --- | --- | --- | --- | --- |
| on | Nightly filing digest | 02:00 daily | Ask Filing Editor | Today, 02:00 | Couldn't start |
| on | Refresh outage summary | SharePoint syncs | Re-run a generated block | 2 hours ago | Started |
| off | Weekly board pack | Mondays, 07:00 | Ask Filing Editor | Never | — |

The switch is in the table, not behind a menu: turning a rule off is the safe
removal, and it should be one click from the list.

**Needs** — `Automation` records with enabled state, rendered trigger and action
phrases, last-fire time and outcome.

## Note

One line: duplicating a rule leaves it off, so a copy cannot fire before it has
been read — and the last result is Started or Couldn't start, because an
Automation is never itself "running".

**Needs** — nothing.
