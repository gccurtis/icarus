# Automation

A standing rule: when this happens, run that. Automations are how
[agent tasks](agent-task.md) start without a person starting them.

```ts
interface Automation {
  projectId: Id<"projects">;
  name: string;
  enabled: boolean;
  trigger: AutomationTrigger;
  action: AutomationAction;
  lastRunAt?: number;
  lastRunStatus?: "success" | "failed";
  lastError?: string;
  runCount: number;
  createdBy: Actor;
  revision: number;
  updatedAt: number;
}

type AutomationTrigger =
  | { kind: "schedule"; cron: string; timezone: string }
  | { kind: "resource_changed"; resourceType: ResourceKind; resourceId?: string }
  | { kind: "connector_synced"; connectorId: Id<"connectors"> }
  | { kind: "finding_created"; questionId?: Id<"questions"> }
  | { kind: "manual" };

type AutomationAction =
  | { kind: "agent_task"; personaId?: Id<"personas">; prompt: string }
  | { kind: "refresh_derived"; derivedOutputId: Id<"derivedOutputs"> };
```

## One trigger, one action

Not a list of either. An automation that fires on three events and does four
things is four automations wearing a trenchcoat — impossible to reason about,
impossible to disable partially, and impossible to attribute a failure within.

Keeping it one-to-one means `enabled`, `lastRunStatus`, and `lastError` describe
something specific.

## Runs are not stored here

There is no `AutomationRun` table. An automation that does work creates an
[agent task](agent-task.md), and that task already records its origin, status,
timing, messages, and errors.

A parallel run-history table would duplicate all of it and immediately disagree
about which is authoritative. What stays here is the small summary a list view
needs — did the last one work, when, how many times has this fired — so the
automation list renders without joining.

`runCount` being a plain counter rather than a derived count is the one
concession to that: it is incremented on each fire and is approximate by nature.

## Timezone is explicit

A `schedule` trigger carries its own `timezone` alongside the cron expression.
"Every weekday at 9am" means a different instant depending on where the person
who wrote it is, and daylight saving makes a stored UTC offset wrong twice a
year. Storing the zone name is the only version that survives.

## Manual triggers

`manual` is a trigger kind so that a saved, named, parameterized piece of work
can exist without a schedule. It is the difference between "run this thing we
set up" and retyping a goal each time.

## Related

[agent task](agent-task.md) · [derived output](../knowledge/derived-output.md) ·
[connector](../special-resources/connector.md)
