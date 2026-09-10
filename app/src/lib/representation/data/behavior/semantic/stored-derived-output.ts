import { admitContentBlocks } from "$representation/data/behavior/content/admission";
import { isResourceRef } from "$representation/data/behavior/core/resource";
import { currentScope } from "$representation/data/behavior/content/admission-inline";
import {
  hasExactFields,
  isStoredActor,
  isStoredNatural,
  isStoredRowId,
  isStoredText,
  isStoredTime,
  storedFields
} from "$representation/data/behavior/core/stored";
import { isStoredSemanticCitation } from "$representation/data/behavior/semantic/stored-citations";
import type { TableRow } from "$representation/store/tables";

const evidenceSelection = (value: unknown): boolean => {
  const selection = storedFields(value);
  return selection !== undefined &&
    hasExactFields(selection, ["evidenceId", "use"]) &&
    isStoredText(selection.evidenceId, 500) && selection.evidenceId.length > 0 &&
    isStoredText(selection.use, 10_000) && selection.use.length > 0;
};

const selection = (value: unknown): boolean => {
  const held = storedFields(value);
  return held !== undefined &&
    hasExactFields(held, ["ref", "from", "to"]) &&
    isResourceRef(held.ref) &&
    isStoredNatural(held.from) &&
    isStoredNatural(held.to) &&
    held.to > held.from;
};

const variableDefinition = (value: unknown): boolean => {
  const definition = storedFields(value);
  return definition !== undefined &&
    hasExactFields(definition, ["name", "prompt"]) &&
    isStoredText(definition.name, 500) && definition.name.length > 0 &&
    isStoredText(definition.prompt) && definition.prompt.length > 0;
};

const template = (value: unknown): boolean => {
  const held = storedFields(value);
  if (
    held === undefined ||
    !hasExactFields(held, ["variables", "output"], ["exampleResponse"]) ||
    !Array.isArray(held.variables) ||
    !held.variables.every(variableDefinition) ||
    !isStoredText(held.output) ||
    held.output.length === 0 ||
    (held.exampleResponse !== undefined && !isStoredText(held.exampleResponse))
  ) return false;
  const names = held.variables.map((entry) => storedFields(entry)?.name);
  return new Set(names).size === names.length;
};

const resourceSet = (value: unknown): boolean => {
  if (!currentScope(value)) return false;
  const held = storedFields(value);
  if (held === undefined) return false;
  const terms = [...held.include as unknown[], ...held.exclude as unknown[]];
  return terms.every((term) => storedFields(term)?.select !== "hole");
};

const variableResolution = (value: unknown): boolean => {
  const resolution = storedFields(value);
  return resolution !== undefined &&
    hasExactFields(resolution, ["name", "value", "evidence"]) &&
    isStoredText(resolution.name, 500) && resolution.name.length > 0 &&
    isStoredText(resolution.value) &&
    Array.isArray(resolution.evidence) &&
    resolution.evidence.every(evidenceSelection);
};

/** Exact current Derived Output row, including each nested discriminated value. */
export const isStoredDerivedOutput = (
  value: unknown
): value is TableRow<"derivedOutputs"> => {
  const row = storedFields(value);
  const baseFields = [
    "_id", "_creationTime", "projectId", "prompt", "definitionRevision", "valueSource",
    "queries", "evidence", "state", "createdBy", "updatedAt"
  ];
  const optionalBaseFields = ["origin", "template", "scope"];
  if (
    row === undefined ||
    !isStoredRowId(row._id, "derivedOutputs") ||
    !isStoredTime(row._creationTime) ||
    !isStoredRowId(row.projectId, "projects") ||
    !isStoredText(row.prompt) || row.prompt.length === 0 ||
    !isStoredNatural(row.definitionRevision) || row.definitionRevision < 1 ||
    (row.origin !== undefined && !isResourceRef(row.origin)) ||
    (row.template !== undefined && !template(row.template)) ||
    (row.scope !== undefined && !resourceSet(row.scope)) ||
    !isStoredActor(row.createdBy) ||
    !isStoredTime(row.updatedAt)
  ) return false;

  if (!Array.isArray(row.queries) || !Array.isArray(row.evidence)) return false;
  const lastVariables = row.lastVariables;
  const noValue = row.valueSource === "none" &&
    row.queries.length === 0 && row.evidence.length === 0;
  const authoredValue = row.valueSource === "authored" &&
    row.queries.length === 0 && row.evidence.length === 0 &&
    admitContentBlocks([row.lastResponse]) !== undefined &&
    isStoredNatural(row.lastRevision) && row.lastRevision > 0;
  const generatedValue = row.valueSource === "generated" &&
    row.queries.every((query) => isStoredText(query, 10_000)) &&
    row.evidence.every(isStoredSemanticCitation) &&
    admitContentBlocks([row.lastResponse]) !== undefined &&
    isStoredNatural(row.lastRevision) && row.lastRevision > 0 &&
    isStoredNatural(row.lastGeneration) &&
    isStoredTime(row.refreshedAt) && row.refreshedAt <= row.updatedAt &&
    (lastVariables === undefined || (
      Array.isArray(lastVariables) && lastVariables.every(variableResolution)
    ));
  if (!noValue && !authoredValue && !generatedValue) return false;

  if (generatedValue && Array.isArray(lastVariables)) {
    const names = lastVariables.map((entry) => storedFields(entry)?.name);
    if (new Set(names).size !== names.length) return false;
  }

  const valueFields = noValue
    ? []
    : authoredValue
      ? ["lastResponse", "lastRevision"]
      : ["lastResponse", "lastRevision", "lastGeneration", "refreshedAt"];
  const optionalValueFields = generatedValue ? ["lastVariables"] : [];
  if (row.state === "idle" && !noValue) return false;
  if (row.state === "fresh" && !generatedValue) return false;
  if (row.state !== "idle" && row.state !== "fresh" && row.state !== "stale" && row.state !== "error") {
    return false;
  }
  const failed = row.state === "error";
  if (failed && (!isStoredText(row.error, 10_000) || row.error.length === 0)) return false;
  return hasExactFields(
    row,
    [...baseFields, ...valueFields, ...(failed ? ["error"] : [])],
    [...optionalBaseFields, ...optionalValueFields]
  );
};

/** Exact current durable refresh job; partial or old job shapes are refused. */
export const isStoredDerivedOutputRefreshJob = (
  value: unknown
): value is TableRow<"derivedOutputRefreshJobs"> => {
  const row = storedFields(value);
  if (row === undefined) return false;
  if (
    !isStoredRowId(row._id, "derivedOutputRefreshJobs") ||
    !isStoredTime(row._creationTime) ||
    !isStoredRowId(row.projectId, "projects") ||
    !isStoredRowId(row.derivedOutputId, "derivedOutputs") ||
    (row.selection !== undefined && !selection(row.selection)) ||
    !isStoredText(row.requestKey, 100_000) || row.requestKey.length === 0 ||
    !isStoredNatural(row.requestedVersion) || row.requestedVersion < 1 ||
    !isStoredNatural(row.attempts) ||
    !isStoredTime(row.queuedAt) ||
    !isStoredTime(row.updatedAt) || row.queuedAt > row.updatedAt
  ) return false;

  const base = [
    "_id", "_creationTime", "projectId", "derivedOutputId", "state", "requestKey",
    "requestedVersion", "attempts", "queuedAt", "updatedAt"
  ];
  if (row.state === "queued") return hasExactFields(row, base, ["selection"]);
  if (row.state === "running") {
    return hasExactFields(row, [...base, "startedAt"], ["selection"]) && row.attempts > 0 &&
      isStoredTime(row.startedAt) && row.startedAt >= row.queuedAt && row.startedAt <= row.updatedAt;
  }
  return row.state === "failed" &&
    hasExactFields(row, [...base, "startedAt", "error"], ["selection"]) &&
    row.attempts > 0 && isStoredTime(row.startedAt) && row.startedAt >= row.queuedAt &&
    row.startedAt <= row.updatedAt && isStoredText(row.error, 10_000) && row.error.length > 0;
};
