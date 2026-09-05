# Automations

## Purpose

Automations manages standing one-trigger/one-action rules. It provides a scalable list, a type-specific editor, manual execution, and last-run health without inventing a workflow graph or run-history table.

The primary entry points are New Tab, Project Overview Health, and automation attribution links.

## Center surface

### Library mode

The main table contains:

| Column | Content |
| --- | --- |
| Enabled | Toggle with name and permission label |
| Name | Automation name |
| Trigger | Human-readable trigger summary |
| Action | Start Agent Task or Refresh Derived Output summary |
| Last fire | Time or Never |
| Dispatch status | Success/Failed for starting the configured action, with last dispatch error badge |
| Runs | Approximate `runCount` |

Search and filters cover enabled state, trigger kind, action kind, and last-run status. The list is cursor-paginated/virtualized. Selecting a row inspects it; Edit enters editor mode. Duplicate creates a disabled copy by default so it cannot fire unexpectedly.

### Editor mode

The fixed header contains editable name, enabled state, revision save state, Run now when legal, Duplicate, and Back to list.

#### Trigger

Exactly one trigger card is selected:

- **Schedule** — cron expression and IANA timezone, with human-readable next-run preview supplied by the scheduler.
- **Resource changed** — resource kind and optional exact resource.
- **Connector synchronized** — one connector.
- **Finding created** — optional exact question association.
- **Manual** — no automatic firing; Run now is the primary action.

#### Action

Exactly one action card is selected:

- **Start Agent Task** — optional Persona and verbatim prompt.
- **Refresh Derived Output** — exact output selected from project Derived Outputs, showing prompt, state, and owning Prompt Block when reverse lookup can find one.

One trigger plus one action is visible together as a sentence: “When [trigger], [action].” Multiple triggers/actions require multiple Automations.

## Context panel

| Key | Label | Contents and organization |
| --- | --- | --- |
| `automations` | Automations | Default. Searchable list grouped Failed, Enabled, Disabled; Create action. |
| `triggers` | Triggers | Five trigger kinds with current selection and required fields. |
| `actions` | Actions | Agent Task and Derived Output choices with Persona/output pickers. |
| `health` | Health | Last-run failures first, Never run, and successful summaries. No fabricated run timeline. |

## Inspector targets

| Selection | Expanded sections | Collapsed sections |
| --- | --- | --- |
| Automation or nothing | Identity/enabled; trigger/action sentence | Creator, revision, updated time |
| Schedule trigger | Cron; timezone; computed next run | Scheduler validation detail |
| Resource trigger | Kind; optional exact resource | Current resource status |
| Connector trigger | Connector identity/status | Last sync/error |
| Finding trigger | Optional question | Current linked findings count when queryable |
| Agent-task action | Persona; prompt | Persona scope/tools/model binding |
| Refresh action | Derived Output prompt/state | Inputs, scope, owner lookup, current provenance |
| Last-run summary | Time; success/failure; last error; approximate count | Spawned task navigation when action created one |

## Run and provenance behavior

- Manual Run now uses the saved trigger/action configuration; it does not turn the Automation into a multi-step task editor.
- An Agent Task action produces a durable task whose `origin` identifies the Automation. That task is the execution trace and opens in the Copilot Inspector.
- A Derived Output refresh action has no run record. Only Automation last-run summary and the output's current generation provenance remain.
- `runCount` is approximate and labeled as such.
- The first runtime contract treats a run as dispatch: increment `runCount` when a trigger is accepted; update `lastRunAt`, `lastRunStatus`, and `lastError` when the action dispatch/request returns. Agent-task Success means the task row was durably created, not that the task eventually completed. Refresh Success means the refresh request was accepted, while the Derived Output's own state reports generation completion/failure. Later task/output failure does not rewrite the Automation summary and remains visible through the linked target.
- Last-run status is Success or Failed only; Running is not a persisted Automation state.
- Disable prevents future firing but does not cancel a task already created.

## Save, conflicts, and deletion

- Edits use revision-based stale-write rejection; entered trigger/action values remain for refresh/reapply.
- Schedule validation distinguishes invalid cron from invalid/unsupported timezone.
- Missing Persona, Connector, Question, Resource, or Derived Output references block save/run and identify the field.
- There is no AutomationRun table, retry model, or complete refresh history.
- Hard deletion can break historical actor labels. Until a tombstone/label-retention policy exists, the safe removal action is Disable; Delete remains gated.

## Retained tab view state

The `automations` state retains Library/Author mode, selected Automation, status filter, query, panel geometry, and an optional typed authoring-session ID. The authoring runtime owns the trigger/action discriminated unions, enabled toggle, dirty fields, and stale-write comparison. Reload restores acknowledged fields and never converts a partially configured rule into an enabled Automation.

## Model coverage

- [Automation](../data-models/ai/automation.md)
- [Agent tasks](../data-models/ai/agent-task.md)
- [Derived outputs](../data-models/knowledge/derived-output.md)
- [Personas](../data-models/ai/persona.md)
- [Connectors](../data-models/special-resources/connector.md)
