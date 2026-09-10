import { admitContentBlocks } from "$representation/data/behavior/content/admission";
import {
  hasExactFields,
  isStoredActor,
  isStoredFinite,
  isStoredNatural,
  isStoredRowId,
  isStoredText,
  isStoredTime,
  storedFields
} from "$representation/data/behavior/core/stored";
import type { TableRow } from "$representation/store/tables";

const positiveRevision = (value: unknown): value is number =>
  isStoredNatural(value) && value >= 1;

const uniqueRowIds = (
  value: unknown,
  table: "questions" | "hypotheses" | "findings" | "researchThreads"
): boolean =>
  Array.isArray(value) &&
  value.every((id) => isStoredRowId(id, table)) &&
  new Set(value).size === value.length;

const relatedItem = (value: unknown): boolean => {
  const item = storedFields(value);
  if (item === undefined || !hasExactFields(item, ["kind", "id"])) return false;
  return item.kind === "hypothesis"
    ? isStoredRowId(item.id, "hypotheses")
    : item.kind === "finding" && isStoredRowId(item.id, "findings");
};

/** One exact current question row, including its closed related-item union. */
export const isStoredQuestion = (value: unknown): value is TableRow<"questions"> => {
  const row = storedFields(value);
  return row !== undefined &&
    hasExactFields(
      row,
      [
        "_id", "_creationTime", "projectId", "text", "notes", "status", "relatedTo",
        "researchThreadIds", "createdBy", "updatedBy", "revision", "updatedAt"
      ],
      ["parentId"]
    ) &&
    isStoredRowId(row._id, "questions") &&
    isStoredTime(row._creationTime) &&
    isStoredRowId(row.projectId, "projects") &&
    isStoredText(row.text) && row.text.trim().length > 0 &&
    admitContentBlocks(row.notes) !== undefined &&
    (row.status === "open" || row.status === "investigating" || row.status === "answered") &&
    Array.isArray(row.relatedTo) && row.relatedTo.every(relatedItem) &&
    new Set(
      (row.relatedTo as Array<{ kind: string; id: string }>).map((item) => `${item.kind}:${item.id}`)
    ).size === row.relatedTo.length &&
    uniqueRowIds(row.researchThreadIds, "researchThreads") &&
    (row.parentId === undefined || isStoredRowId(row.parentId, "questions")) &&
    isStoredActor(row.createdBy) &&
    isStoredActor(row.updatedBy) &&
    positiveRevision(row.revision) &&
    isStoredTime(row.updatedAt);
};

const hypothesisEvidence = (value: unknown): boolean => {
  const evidence = storedFields(value);
  return evidence !== undefined &&
    hasExactFields(
      evidence,
      ["findingId", "bearing", "createdBy", "updatedBy", "revision", "updatedAt"],
      ["note"]
    ) &&
    isStoredRowId(evidence.findingId, "findings") &&
    (evidence.bearing === "supports" || evidence.bearing === "refutes" || evidence.bearing === "neutral") &&
    (evidence.note === undefined || isStoredText(evidence.note, 10_000)) &&
    isStoredActor(evidence.createdBy) &&
    isStoredActor(evidence.updatedBy) &&
    positiveRevision(evidence.revision) &&
    isStoredTime(evidence.updatedAt);
};

/** One exact current hypothesis row and every exact current evidence edge. */
export const isStoredHypothesis = (value: unknown): value is TableRow<"hypotheses"> => {
  const row = storedFields(value);
  return row !== undefined &&
    hasExactFields(
      row,
      [
        "_id", "_creationTime", "projectId", "statement", "notes", "assessment", "evidence",
        "relatedTo", "researchThreadIds", "createdBy", "updatedBy", "revision", "updatedAt"
      ],
      ["confidence"]
    ) &&
    isStoredRowId(row._id, "hypotheses") &&
    isStoredTime(row._creationTime) &&
    isStoredRowId(row.projectId, "projects") &&
    isStoredText(row.statement) && row.statement.trim().length > 0 &&
    admitContentBlocks(row.notes) !== undefined &&
    (
      row.assessment === "untested" || row.assessment === "testing" ||
      row.assessment === "supported" || row.assessment === "refuted" ||
      row.assessment === "inconclusive"
    ) &&
    (row.confidence === undefined || (
      isStoredFinite(row.confidence) && row.confidence >= 0 && row.confidence <= 1
    )) &&
    Array.isArray(row.evidence) && row.evidence.every(hypothesisEvidence) &&
    new Set((row.evidence as Array<{ findingId: string }>).map((edge) => edge.findingId)).size === row.evidence.length &&
    uniqueRowIds(row.relatedTo, "questions") &&
    uniqueRowIds(row.researchThreadIds, "researchThreads") &&
    isStoredActor(row.createdBy) &&
    isStoredActor(row.updatedBy) &&
    positiveRevision(row.revision) &&
    isStoredTime(row.updatedAt);
};
