import {
  canonical, exact, natural, recordOf, text
} from "$representation/data/behavior/content/admission-values";
import { isStoredActor, isStoredRowId, isStoredTime } from "$representation/data/behavior/core/stored";
import type { ActivityEvent } from "$representation/data/types/collaboration/activity";
import type { TableRow } from "$representation/store/tables";

const currentName = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= 240 &&
  value === value.trim() && value === value.normalize("NFC") &&
  !value.includes("/") && !value.includes("\\") &&
  !/[\u0000-\u001f\u007f]/u.test(value);

const currentMediaType = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= 200 &&
  value === value.trim() && /^[\x20-\x7e]+$/u.test(value);

const currentPath = (value: unknown): value is string => {
  if (typeof value !== "string" || value.length > 10_000) return false;
  if (value.length === 0 || value !== value.normalize("NFC") || value.includes("\\") ||
    value.startsWith("/") || /^[a-z]:\//i.test(value) || /[\u0000-\u001f\u007f]/u.test(value)) {
    return false;
  }
  return value.split("/").every((part) => part !== "" && part !== "." && part !== "..");
};

const fileNameIn = (path: unknown): unknown =>
  typeof path === "string" ? path.split("/").at(-1) : undefined;

const externalFileSubject = (value: unknown): boolean => {
  const subject = recordOf(value);
  return subject !== undefined && exact(subject, ["id", "name", "relativePath"]) &&
    isStoredRowId(subject.id, "externalFiles") && currentName(subject.name) &&
    currentPath(subject.relativePath) && fileNameIn(subject.relativePath) === subject.name;
};

const taskSubject = (value: unknown): boolean => {
  const subject = recordOf(value);
  return subject !== undefined && exact(subject, ["id", "title"]) &&
    isStoredRowId(subject.id, "agentTasks") && canonical(subject.title, 10_000);
};

const personaSubject = (value: unknown): boolean => {
  const persona = recordOf(value);
  return persona !== undefined && exact(persona, ["id", "name"]) &&
    isStoredRowId(persona.id, "personas") && canonical(persona.name, 240);
};

const positiveRevision = (value: unknown): boolean => natural(value) && value > 0;

const currentOrigin = (value: unknown): boolean => {
  const origin = recordOf(value);
  if (origin === undefined) return false;
  if (origin.kind === "person") return exact(origin, ["kind"]);
  return origin.kind === "automation" &&
    exact(origin, ["kind", "automationId", "automationName"]) &&
    isStoredRowId(origin.automationId, "automations") && canonical(origin.automationName, 240);
};

export const isStoredActivityEvent = (value: unknown): value is ActivityEvent => {
  const event = recordOf(value);
  if (event === undefined || !text(event.kind, 80)) return false;
  if (event.kind === "external-file.uploaded") {
    return exact(event, ["kind", "file", "size", "mediaType"]) &&
      externalFileSubject(event.file) && natural(event.size) && currentMediaType(event.mediaType);
  }
  if (event.kind === "external-file.reuploaded") {
    return exact(event, ["kind", "file", "replacementName", "size", "revision"]) &&
      externalFileSubject(event.file) && currentName(event.replacementName) &&
      natural(event.size) && positiveRevision(event.revision);
  }
  if (event.kind === "external-file.renamed") {
    return exact(event, ["kind", "file", "previousName", "previousRelativePath"]) &&
      externalFileSubject(event.file) && currentName(event.previousName) &&
      currentPath(event.previousRelativePath) &&
      fileNameIn(event.previousRelativePath) === event.previousName;
  }
  if (event.kind === "external-file.moved") {
    const file = recordOf(event.file);
    return exact(event, ["kind", "file", "previousRelativePath"]) &&
      externalFileSubject(file) && currentPath(event.previousRelativePath) &&
      fileNameIn(event.previousRelativePath) === file?.name;
  }
  if (event.kind === "external-file.context-changed") {
    return exact(event, ["kind", "file", "change"]) && externalFileSubject(event.file) &&
      (event.change === "set" || event.change === "cleared");
  }
  if (event.kind === "external-file.deleted") {
    return exact(event, ["kind", "file", "size", "revision"]) &&
      externalFileSubject(event.file) && natural(event.size) && positiveRevision(event.revision);
  }
  if (event.kind === "agents.task-started") {
    return exact(event, ["kind", "task", "persona", "origin"]) && taskSubject(event.task) &&
      personaSubject(event.persona) && currentOrigin(event.origin);
  }
  return event.kind === "agents.task-completed" &&
    exact(event, ["kind", "task", "persona", "outcome", "sourceCount"]) &&
    taskSubject(event.task) && personaSubject(event.persona) &&
    (event.outcome === "answered" || event.outcome === "insufficient-evidence") &&
    natural(event.sourceCount);
};

export const isStoredActivity = (value: unknown): value is TableRow<"activity"> => {
  const row = recordOf(value);
  if (row === undefined || !exact(
    row,
    ["_id", "_creationTime", "projectId", "actor", "actorLabel", "event"]
  ) ||
    !isStoredRowId(row._id, "activity") || !isStoredTime(row._creationTime) ||
    !isStoredRowId(row.projectId, "projects") || !isStoredActor(row.actor) ||
    !canonical(row.actorLabel, 240) || !isStoredActivityEvent(row.event)) return false;
  if (row.event.kind === "agents.task-completed") {
    return row.actor.kind === "agent" && row.actor.taskId === row.event.task.id;
  }
  return row.actor.kind === "user";
};
