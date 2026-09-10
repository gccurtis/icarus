import {
  admitContentBlocks,
  currentResourceRef
} from "$representation/data/behavior/content/admission";
import {
  hasExactFields,
  isStoredActor,
  isStoredIdentifier,
  isStoredNatural,
  isStoredRowId,
  isStoredText,
  isStoredTime,
  storedFields
} from "$representation/data/behavior/core/stored";
import type { TableRow } from "$representation/store/tables";

const branchPoint = (value: unknown): boolean => {
  const branch = storedFields(value);
  return branch !== undefined &&
    hasExactFields(branch, ["threadId", "messageId", "index"]) &&
    isStoredRowId(branch.threadId, "threads") &&
    isStoredIdentifier(branch.messageId) &&
    isStoredNatural(branch.index);
};

/** One exact current conversation identity row. */
export const isStoredThread = (value: unknown): value is TableRow<"threads"> => {
  const row = storedFields(value);
  return row !== undefined &&
    hasExactFields(row, ["_id", "_creationTime", "projectId", "kind"], ["branchedFrom"]) &&
    isStoredRowId(row._id, "threads") &&
    isStoredTime(row._creationTime) &&
    isStoredRowId(row.projectId, "projects") &&
    (row.kind === "researchThread" || row.kind === "agentTask") &&
    (row.branchedFrom === undefined || branchPoint(row.branchedFrom));
};

const message = (value: unknown): boolean => {
  const held = storedFields(value);
  return held !== undefined &&
    hasExactFields(
      held,
      ["id", "role", "sentAt", "blocks", "state"],
      ["author", "attachments", "labels", "error"]
    ) &&
    isStoredIdentifier(held.id) &&
    (held.role === "prompt" || held.role === "response") &&
    (held.author === undefined || isStoredActor(held.author)) &&
    isStoredTime(held.sentAt) &&
    admitContentBlocks(held.blocks) !== undefined &&
    (held.attachments === undefined || (
      Array.isArray(held.attachments) && held.attachments.every(currentResourceRef)
    )) &&
    (held.labels === undefined || (
      Array.isArray(held.labels) &&
      held.labels.every((label) => isStoredText(label, 500)) &&
      new Set(held.labels).size === held.labels.length
    )) &&
    (held.state === "streaming" || held.state === "complete" || held.state === "error") &&
    (held.error === undefined || isStoredText(held.error, 10_000));
};

/** One exact current message partition; no malformed member is partially admitted. */
export const isStoredThreadPart = (value: unknown): value is TableRow<"threadParts"> => {
  const row = storedFields(value);
  return row !== undefined &&
    hasExactFields(
      row,
      ["_id", "_creationTime", "projectId", "threadId", "part", "messages"]
    ) &&
    isStoredRowId(row._id, "threadParts") &&
    isStoredTime(row._creationTime) &&
    isStoredRowId(row.projectId, "projects") &&
    isStoredRowId(row.threadId, "threads") &&
    isStoredNatural(row.part) && row.part >= 1 &&
    Array.isArray(row.messages) &&
    row.messages.every(message) &&
    new Set((row.messages as Array<{ id: string }>).map((entry) => entry.id)).size === row.messages.length;
};
