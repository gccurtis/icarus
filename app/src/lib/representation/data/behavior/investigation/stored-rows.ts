import { admitContentBlocks } from "$representation/data/behavior/content/admission";
import { isResourceRef } from "$representation/data/behavior/core/resource";
import {
  hasExactFields,
  isStoredActor,
  isStoredChoice,
  isStoredIdentifier,
  isStoredNatural,
  isStoredRowId,
  isStoredText,
  isStoredTime,
  storedFields
} from "$representation/data/behavior/core/stored";
import type { TableRow } from "$representation/store/tables";

const mode = (value: unknown): boolean => {
  const held = storedFields(value);
  if (held === undefined) return false;
  if (held.kind === "explore") return hasExactFields(held, ["kind"]);
  if (held.kind === "question") {
    return hasExactFields(held, ["kind", "questionId"]) && isStoredRowId(held.questionId, "questions");
  }
  return held.kind === "hypothesis" && hasExactFields(held, ["kind", "hypothesisId"]) &&
    isStoredRowId(held.hypothesisId, "hypotheses");
};

const scope = (value: unknown): boolean => {
  const held = storedFields(value);
  if (held === undefined) return false;
  if (held.kind === "project") return hasExactFields(held, ["kind"]);
  return held.kind === "resource" && hasExactFields(held, ["kind", "ref"]) &&
    isResourceRef(held.ref);
};

const source = (value: unknown): boolean => {
  const held = storedFields(value);
  return held !== undefined && hasExactFields(
    held,
    ["id", "ref", "title", "excerpt", "uses"],
    ["locator"]
  ) && isStoredIdentifier(held.id) && isResourceRef(held.ref) &&
    isStoredText(held.title, 10_000) &&
    (!Object.hasOwn(held, "locator") || isStoredText(held.locator, 10_000)) &&
    isStoredText(held.excerpt) && Array.isArray(held.uses) &&
    held.uses.every((use) => isStoredText(use, 10_000));
};

const finding = (value: unknown): boolean => {
  const held = storedFields(value);
  return held !== undefined && hasExactFields(held, ["id", "text", "sourceIds"]) &&
    isStoredIdentifier(held.id) && isStoredText(held.text) && Array.isArray(held.sourceIds) &&
    held.sourceIds.every((id) => isStoredIdentifier(id));
};

const usage = (value: unknown): boolean => {
  const held = storedFields(value);
  return held !== undefined && hasExactFields(
    held,
    ["requests", "promptTokens", "completionTokens", "totalTokens"],
    ["costUsd"]
  ) && isStoredNatural(held.requests) && isStoredNatural(held.promptTokens) &&
    isStoredNatural(held.completionTokens) && isStoredNatural(held.totalTokens) &&
    held.requests > 0 && held.totalTokens === held.promptTokens + held.completionTokens &&
    (!Object.hasOwn(held, "costUsd") || (
      typeof held.costUsd === "number" && Number.isFinite(held.costUsd) && held.costUsd >= 0
    ));
};

const TURN_IDENTITY = ["_id", "_creationTime"] as const;
const TURN_COMMON = [
  "projectId", "researchThreadId", "threadId", "promptMessageId", "prompt", "mode", "scope",
  "tools", "state", "blocks", "queries", "sources", "findings", "askedAt", "updatedAt"
] as const;
const TURN_RUNNING = [...TURN_IDENTITY, ...TURN_COMMON] as const;
const TURN_COMPLETED = [
  ...TURN_RUNNING, "messageId", "usage", "model", "answeredAt"
] as const;
const TURN_UNSUCCESSFUL = [...TURN_RUNNING, "error"] as const;

const exactTurnArm = (row: Record<string, unknown>): boolean => {
  const optional = ["stopRequestedAt"] as const;
  if (row.state === "running") return hasExactFields(row, TURN_RUNNING, optional);
  if (row.state === "answered" || row.state === "insufficient") {
    return hasExactFields(row, TURN_COMPLETED, optional);
  }
  if (row.state === "failed" || row.state === "cancelled") {
    return hasExactFields(row, TURN_UNSUCCESSFUL, optional);
  }
  return false;
};

const exactRowIdentity = (
  row: Record<string, unknown>,
  table: "researchThreads" | "researchTurns"
): boolean =>
  isStoredRowId(row._id, table) &&
  isStoredTime(row._creationTime);

/** Exact current research-thread row; former persona-thread shapes are not admitted. */
export const isStoredResearchThread = (
  value: unknown
): value is TableRow<"researchThreads"> => {
  const row = storedFields(value);
  return row !== undefined && hasExactFields(
    row,
    [
      "_id", "_creationTime", "projectId", "threadId", "title", "mode", "findingIds",
      "createdBy", "updatedAt"
    ],
    ["summary", "personaId"]
  ) && exactRowIdentity(row, "researchThreads") && isStoredRowId(row.projectId, "projects") &&
    isStoredRowId(row.threadId, "threads") && isStoredText(row.title, 10_000) && row.title.length > 0 &&
    (row.summary === undefined || isStoredText(row.summary)) && mode(row.mode) &&
    (row.personaId === undefined || isStoredRowId(row.personaId, "personas")) &&
    Array.isArray(row.findingIds) && row.findingIds.every((id) => isStoredRowId(id, "findings")) &&
    new Set(row.findingIds).size === row.findingIds.length && isStoredActor(row.createdBy) &&
    isStoredTime(row.updatedAt);
};

/** Exact current research-turn row, including every nested variant and result value. */
export const isStoredResearchTurn = (
  value: unknown
): value is TableRow<"researchTurns"> => {
  const row = storedFields(value);
  if (row === undefined || !exactTurnArm(row) ||
    !exactRowIdentity(row, "researchTurns") || !isStoredRowId(row.projectId, "projects") ||
    !isStoredRowId(row.researchThreadId, "researchThreads") || !isStoredRowId(row.threadId, "threads") ||
    !isStoredIdentifier(row.promptMessageId) ||
    !isStoredText(row.prompt) || row.prompt.trim().length === 0 || !mode(row.mode) ||
    !scope(row.scope) || !Array.isArray(row.tools) ||
    !row.tools.every((tool) => tool === "web.search") ||
    new Set(row.tools).size !== row.tools.length ||
    !isStoredChoice(row.state, ["running", "answered", "insufficient", "failed", "cancelled"]) ||
    (Object.hasOwn(row, "stopRequestedAt") && !isStoredTime(row.stopRequestedAt)) ||
    admitContentBlocks(row.blocks) === undefined || !Array.isArray(row.queries) ||
    !row.queries.every((query) => isStoredText(query, 10_000)) || !Array.isArray(row.sources) ||
    !row.sources.every(source) || !Array.isArray(row.findings) || !row.findings.every(finding) ||
    !isStoredTime(row.askedAt) || !isStoredTime(row.updatedAt) || row.updatedAt < row.askedAt ||
    (Object.hasOwn(row, "stopRequestedAt") && (
      (row.stopRequestedAt as number) < row.askedAt || (row.stopRequestedAt as number) > row.updatedAt
    ))) return false;

  if (row.state === "running") {
    return (row.blocks as unknown[]).length === 0 && row.queries.length === 0 &&
      row.sources.length === 0 && row.findings.length === 0;
  }

  if (row.state === "failed" || row.state === "cancelled") {
    return isStoredText(row.error, 10_000) && row.error.trim().length > 0 &&
      (row.blocks as unknown[]).length === 0 && row.queries.length === 0 && row.sources.length === 0 &&
      row.findings.length === 0;
  }

  if (!isStoredIdentifier(row.messageId) || !usage(row.usage) ||
    !isStoredText(row.model, 500) || row.model.trim().length === 0 ||
    !isStoredTime(row.answeredAt) || row.answeredAt !== row.updatedAt) return false;

  const sources = row.sources as Array<{ id: string }>;
  const sourceIds = new Set(sources.map((entry) => entry.id));
  const findings = row.findings as Array<{ id: string; sourceIds: string[] }>;
  return sourceIds.size === sources.length &&
    new Set(findings.map((entry) => entry.id)).size === findings.length &&
    findings.every((entry) => entry.sourceIds.every((id) => sourceIds.has(id)));
};
