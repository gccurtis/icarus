import { admitContentBlocks } from "$representation/data/behavior/content/admission";
import { isResourceRef } from "$representation/data/behavior/core/resource";
import { currentScope } from "$representation/data/behavior/content/admission-inline";
import {
  hasExactFields,
  isStoredActor,
  isStoredChoice,
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
    hasExactFields(definition, ["name", "prompt"], ["origin"]) &&
    isStoredText(definition.name, 500) && definition.name.length > 0 &&
    isStoredText(definition.prompt) && definition.prompt.length > 0 &&
    (definition.origin === undefined || isResourceRef(definition.origin));
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
  if (
    row === undefined ||
    !hasExactFields(
      row,
      [
        "_id", "_creationTime", "projectId", "prompt", "definitionRevision", "queries",
        "evidence", "state", "createdBy", "updatedAt"
      ],
      [
        "origin", "template", "scope", "lastVariables", "lastResponse", "lastRevision",
        "lastGeneration", "error", "refreshedAt"
      ]
    ) ||
    !isStoredRowId(row._id, "derivedOutputs") ||
    !isStoredTime(row._creationTime) ||
    !isStoredRowId(row.projectId, "projects") ||
    !isStoredText(row.prompt) || row.prompt.length === 0 ||
    !isStoredNatural(row.definitionRevision) || row.definitionRevision < 1 ||
    (row.origin !== undefined && !isResourceRef(row.origin)) ||
    (row.template !== undefined && !template(row.template)) ||
    (row.scope !== undefined && !resourceSet(row.scope)) ||
    !Array.isArray(row.queries) || !row.queries.every((query) => isStoredText(query, 10_000)) ||
    !Array.isArray(row.evidence) || !row.evidence.every(isStoredSemanticCitation) ||
    (row.lastVariables !== undefined && (
      !Array.isArray(row.lastVariables) || !row.lastVariables.every(variableResolution)
    )) ||
    (row.lastResponse !== undefined && admitContentBlocks([row.lastResponse]) === undefined) ||
    (row.lastRevision !== undefined && !isStoredNatural(row.lastRevision)) ||
    (row.lastGeneration !== undefined && !isStoredNatural(row.lastGeneration)) ||
    !isStoredChoice(row.state, ["idle", "fresh", "stale", "error"]) ||
    (row.error !== undefined && !isStoredText(row.error, 10_000)) ||
    (row.refreshedAt !== undefined && !isStoredTime(row.refreshedAt)) ||
    !isStoredActor(row.createdBy) ||
    !isStoredTime(row.updatedAt)
  ) return false;

  if (row.lastVariables !== undefined) {
    const names = row.lastVariables.map((entry) => storedFields(entry)?.name);
    if (new Set(names).size !== names.length) return false;
  }
  return true;
};

/** Exact current durable refresh job; partial or old job shapes are refused. */
export const isStoredDerivedOutputRefreshJob = (
  value: unknown
): value is TableRow<"derivedOutputRefreshJobs"> => {
  const row = storedFields(value);
  return row !== undefined &&
    hasExactFields(
      row,
      [
        "_id", "_creationTime", "projectId", "derivedOutputId", "state", "requestKey",
        "requestedVersion", "attempts", "queuedAt", "updatedAt"
      ],
      ["selection", "error", "startedAt"]
    ) &&
    isStoredRowId(row._id, "derivedOutputRefreshJobs") &&
    isStoredTime(row._creationTime) &&
    isStoredRowId(row.projectId, "projects") &&
    isStoredRowId(row.derivedOutputId, "derivedOutputs") &&
    (row.selection === undefined || selection(row.selection)) &&
    isStoredChoice(row.state, ["queued", "running", "failed"]) &&
    isStoredText(row.requestKey, 100_000) && row.requestKey.length > 0 &&
    isStoredNatural(row.requestedVersion) && row.requestedVersion >= 1 &&
    isStoredNatural(row.attempts) &&
    (row.error === undefined || isStoredText(row.error, 10_000)) &&
    isStoredTime(row.queuedAt) &&
    (row.startedAt === undefined || isStoredTime(row.startedAt)) &&
    isStoredTime(row.updatedAt);
};
