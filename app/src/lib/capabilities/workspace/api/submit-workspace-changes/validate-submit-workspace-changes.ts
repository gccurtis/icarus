import type { WorkspaceOp } from "$representation/data/types/workspace/op";
import type { WorkspaceChangeSetInput } from "$capabilities/workspace/types/submit-workspace-changes";

const OPS = ["open", "close", "activate", "land", "context", "inspect", "resize", "zoom"];

const refuse = (what: string): never => {
  throw new Error(`workspace/submit-workspace-changes: ${what}`);
};

const isOp = (value: unknown): value is WorkspaceOp => {
  if (value === null || typeof value !== "object") return false;

  const { op } = value as { op?: unknown };
  return typeof op === "string" && OPS.includes(op);
};

export const validateSubmitWorkspaceChanges = (input: unknown): WorkspaceChangeSetInput => {
  if (input === null || typeof input !== "object") refuse("an input is an object");

  const { changeSet } = input as { changeSet?: unknown };
  if (changeSet === null || typeof changeSet !== "object") refuse("a changeSet is required");

  const { baseRevision, ops } = changeSet as Record<string, unknown>;

  if (typeof baseRevision !== "number" || !Number.isInteger(baseRevision) || baseRevision < 0) {
    refuse("baseRevision is a revision number");
  }
  if (!Array.isArray(ops) || ops.length === 0) {
    refuse("a change set carries at least one op");
  }
  if (!(ops as unknown[]).every(isOp)) {
    refuse("every op names one of the workspace operations");
  }

  return { baseRevision: baseRevision as number, ops: ops as readonly WorkspaceOp[] };
};
