import { createHash } from "node:crypto";

import { readCurrentRows, type StoreUnitOfWork } from "$model/server/store/index.server";
import { asId } from "$representation/data/behavior/core/id";
import type {
  ActivityEvent,
  ActivityPresentation
} from "$representation/data/types/collaboration/activity";
import type { Actor } from "$representation/data/types/core/actor";
import type { Id } from "$representation/data/types/core/id";
import type { Scope } from "$runtime/server/scope.server";

const externalPathId = (relativePath: string): string =>
  `external-path:${createHash("sha256").update(relativePath).digest("hex")}`;

const externalTarget = (event: Extract<ActivityEvent, { file: unknown }>) => ({
  target: { kind: "external-file", id: event.file.id, label: event.file.name },
  context: {
    kind: "external-path",
    id: externalPathId(event.file.relativePath),
    label: event.file.relativePath
  }
});

const sources = (count: number): string => `${count} ${count === 1 ? "source" : "sources"}`;

const bytes = (value: number): string => {
  if (value < 1_000) return `${value} B`;
  if (value < 1_000_000) return `${(value / 1_000).toFixed(value < 10_000 ? 1 : 0)} KB`;
  if (value < 1_000_000_000) return `${(value / 1_000_000).toFixed(value < 10_000_000 ? 1 : 0)} MB`;
  return `${(value / 1_000_000_000).toFixed(1)} GB`;
};

const media = (value: string): string => {
  if (value === "application/pdf") return "PDF";
  const part = value.split("/", 2)[1]?.split(/[;+]/, 1)[0];
  return (part === undefined ? value : part).toLocaleUpperCase();
};

const directory = (path: string): string => {
  const parts = path.split("/");
  return parts.length === 1 ? "/" : `/${parts.slice(0, -1).join("/")}`;
};

export const activityPresentation = (event: ActivityEvent): ActivityPresentation => {
  if (event.kind === "external-file.uploaded") return {
    type: event.kind, what: `Uploaded ${bytes(event.size)} ${media(event.mediaType)}`,
    action: "uploaded a file", ...externalTarget(event), detail: event.mediaType
  };
  if (event.kind === "external-file.reuploaded") return {
    type: event.kind, what: "Replaced file contents", action: "replaced file contents",
    ...externalTarget(event),
    detail: `${event.replacementName} · ${bytes(event.size)} · revision ${event.revision}`
  };
  if (event.kind === "external-file.renamed") return {
    type: event.kind, what: `Renamed “${event.previousName}” to “${event.file.name}”`,
    action: "renamed a file", ...externalTarget(event)
  };
  if (event.kind === "external-file.moved") return {
    type: event.kind,
    what: `Moved from ${directory(event.previousRelativePath)} to ${directory(event.file.relativePath)}`,
    action: "moved a file", ...externalTarget(event)
  };
  if (event.kind === "external-file.context-changed") return {
    type: event.kind,
    what: event.change === "cleared" ? "Cleared dataset context" : "Added dataset context",
    action: event.change === "cleared" ? "cleared dataset context" : "added dataset context",
    ...externalTarget(event)
  };
  if (event.kind === "external-file.deleted") return {
    type: event.kind, what: `Deleted ${bytes(event.size)} file`, action: "deleted a file",
    ...externalTarget(event), detail: `Deleted at revision ${event.revision}`
  };
  if (event.kind === "agents.task-started") return {
    type: event.kind,
    what: "Started an Agents task",
    action: "started an Agents task",
    target: { kind: "task", id: event.task.id, label: event.task.title },
    detail: event.origin.kind === "automation"
      ? `Using ${event.persona.name} · From ${event.origin.automationName}`
      : `Using ${event.persona.name}`
  };
  return {
    type: event.kind,
    what: "Completed an Agents task",
    action: "completed an Agents task",
    target: { kind: "task", id: event.task.id, label: event.task.title },
    detail: `${event.outcome === "answered" ? "Answered" : "Insufficient evidence"} · ${sources(event.sourceCount)}`
  };
};

const record = (
  unit: StoreUnitOfWork,
  projectId: Id<"projects">,
  actor: Actor,
  actorLabel: string,
  event: ActivityEvent
): Id<"activity"> => unit.create("activity", { projectId, actor, actorLabel, event });

const requireExternalFile = (
  unit: StoreUnitOfWork,
  projectId: string,
  event: Extract<ActivityEvent, { file: unknown }>
): void => {
  const file = readCurrentRows(unit, "externalFiles").find((row) => row._id === event.file.id);
  if (file === undefined || file.projectId !== projectId || file.name !== event.file.name ||
    file.relativePath !== event.file.relativePath) {
    throw new Error("Activity must describe the current External file in this project");
  }
};

const requireAgentSubjects = (
  unit: StoreUnitOfWork,
  projectId: string,
  event: Extract<ActivityEvent, { kind: `agents.${string}` }>
): void => {
  const task = readCurrentRows(unit, "agentTasks").find((row) => row._id === event.task.id);
  const persona = readCurrentRows(unit, "personas").find((row) => row._id === event.persona.id);
  if (task === undefined || task.projectId !== projectId || task.title !== event.task.title ||
    persona === undefined || persona.projectId !== projectId || persona.name !== event.persona.name ||
    task.personaId !== persona._id) {
    throw new Error("Activity must describe the current Agents task and persona in this project");
  }
  if (event.kind === "agents.task-started" && event.origin.kind === "automation") {
    const origin = event.origin;
    const automation = readCurrentRows(unit, "automations").find(
      (row) => row._id === origin.automationId
    );
    if (automation === undefined || automation.projectId !== projectId ||
      automation.name !== origin.automationName || automation.personaId !== persona._id) {
      throw new Error("Activity must describe the current automation in this project");
    }
  }
};

const existingTaskActivity = (
  unit: StoreUnitOfWork,
  projectId: string,
  event: Extract<ActivityEvent, { kind: `agents.${string}` }>
): Id<"activity"> | undefined => readCurrentRows(unit, "activity").find(
  (row) => row.projectId === projectId && row.event.kind === event.kind &&
    "task" in row.event && row.event.task.id === event.task.id
)?._id;

export const recordExternalFileActivity = (
  unit: StoreUnitOfWork,
  scope: Scope,
  event: Extract<ActivityEvent, { file: unknown }>
): Id<"activity"> => {
  requireExternalFile(unit, scope.projectId, event);
  return record(
    unit,
    asId<"projects">(scope.projectId),
    { kind: "user", userId: asId<"users">(scope.userId) },
    scope.username,
    event
  );
};

export const recordAgentTaskStartedActivity = (
  unit: StoreUnitOfWork,
  scope: Scope,
  event: Extract<ActivityEvent, { kind: "agents.task-started" }>
): Id<"activity"> => {
  requireAgentSubjects(unit, scope.projectId, event);
  const existing = existingTaskActivity(unit, scope.projectId, event);
  if (existing !== undefined) return existing;
  return record(
    unit,
    asId<"projects">(scope.projectId),
    { kind: "user", userId: asId<"users">(scope.userId) },
    scope.username,
    event
  );
};

export const recordAgentTaskCompletedActivity = (
  unit: StoreUnitOfWork,
  projectId: Id<"projects">,
  event: Extract<ActivityEvent, { kind: "agents.task-completed" }>
): Id<"activity"> => {
  requireAgentSubjects(unit, projectId, event);
  const existing = existingTaskActivity(unit, projectId, event);
  if (existing !== undefined) return existing;
  return record(
    unit,
    projectId,
    { kind: "agent", taskId: event.task.id },
    event.persona.name,
    event
  );
};
