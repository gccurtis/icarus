import type { StoreUnitOfWork } from "$model/server/store/index.server";
import type { AnchorWithin } from "$representation/data/types/collaboration/anchor";
import type { CommentTarget } from "$representation/data/types/collaboration/comment";

type Fields = Record<string, unknown>;

const recordOf = (value: unknown): Fields | undefined =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Fields
    : undefined;

const exact = (
  value: Fields,
  required: readonly string[],
  optional: readonly string[] = []
): boolean => {
  const keys = Object.keys(value);
  return required.every((key) => keys.includes(key)) &&
    keys.every((key) => required.includes(key) || optional.includes(key));
};

const identifier = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length > 0 &&
  value.length <= 500 &&
  value === value.trim() &&
  !/[.\s]/.test(value);

const text = (value: unknown): value is string =>
  typeof value === "string" && value.length <= 100_000;

const time = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

const actorIsCurrent = (value: unknown): boolean => {
  const actor = recordOf(value);
  if (actor === undefined) return false;
  if (actor.kind === "system") return exact(actor, ["kind"]);
  if (actor.kind === "user") {
    return exact(actor, ["kind", "userId"]) && identifier(actor.userId);
  }
  if (actor.kind === "agent") {
    return exact(actor, ["kind", "taskId"]) && identifier(actor.taskId);
  }
  return actor.kind === "connector" &&
    exact(actor, ["kind", "connectorId"]) &&
    identifier(actor.connectorId);
};

const endIsCurrent = (value: unknown): boolean => {
  const end = recordOf(value);
  return end !== undefined &&
    exact(end, ["atom", "offset"]) &&
    identifier(end.atom) &&
    Number.isInteger(end.offset) &&
    Number(end.offset) >= 0;
};

const anchorOf = (value: unknown, targetKind: string): AnchorWithin | undefined => {
  const anchor = recordOf(value);
  if (anchor === undefined) return undefined;
  if (targetKind === "document" && anchor.kind === "text" && exact(anchor, ["kind", "spans"])) {
    if (!Array.isArray(anchor.spans) || anchor.spans.length === 0) return undefined;
    const valid = anchor.spans.every((entry) => {
      const span = recordOf(entry);
      return span !== undefined &&
        exact(span, ["blockId", "from", "to"]) &&
        identifier(span.blockId) &&
        endIsCurrent(span.from) &&
        endIsCurrent(span.to);
    });
    return valid ? anchor as AnchorWithin : undefined;
  }
  if (
    targetKind === "slides" &&
    anchor.kind === "slide" &&
    exact(anchor, ["kind", "slideId"]) &&
    identifier(anchor.slideId)
  ) return anchor as AnchorWithin;
  if (
    targetKind === "slides" &&
    anchor.kind === "element" &&
    exact(anchor, ["kind", "elementId"]) &&
    identifier(anchor.elementId)
  ) return anchor as AnchorWithin;
  if (
    targetKind === "spreadsheet" &&
    anchor.kind === "cell" &&
    exact(anchor, ["kind", "rowId", "columnId"]) &&
    identifier(anchor.rowId) &&
    identifier(anchor.columnId)
  ) return anchor as AnchorWithin;
  return undefined;
};

const tableFor = (kind: string): "documents" | "slideDecks" | "spreadsheets" | undefined =>
  kind === "document"
    ? "documents"
    : kind === "slides"
      ? "slideDecks"
      : kind === "spreadsheet"
        ? "spreadsheets"
        : undefined;

const targetOf = (value: unknown): CommentTarget | undefined => {
  const target = recordOf(value);
  if (
    target === undefined ||
    !exact(target, ["kind", "id"]) ||
    typeof target.kind !== "string" ||
    !identifier(target.id)
  ) return undefined;
  const table = tableFor(target.kind);
  if (
    table === undefined ||
    !target.id.startsWith(`${table}:`) ||
    target.id.length === table.length + 1 ||
    /[.:\s]/.test(target.id.slice(table.length + 1))
  ) return undefined;
  return { kind: target.kind, id: target.id } as CommentTarget;
};

export const resourceRowIsCurrent = (
  value: unknown,
  table: "documents" | "slideDecks" | "spreadsheets",
  projectId: string,
  resourceId: string
): boolean => {
  const row = recordOf(value);
  return row !== undefined &&
    exact(
      row,
      ["_id", "_creationTime", "projectId", "title", "createdBy", "updatedBy", "updatedAt"],
      ["summary"]
    ) &&
    row._id === resourceId &&
    resourceId.startsWith(`${table}:`) &&
    resourceId.length > table.length + 1 &&
    !/[.:\s]/.test(resourceId.slice(table.length + 1)) &&
    row.projectId === projectId &&
    time(row._creationTime) &&
    text(row.title) &&
    (row.summary === undefined || text(row.summary)) &&
    actorIsCurrent(row.createdBy) &&
    actorIsCurrent(row.updatedBy) &&
    time(row.updatedAt);
};

export const currentStageResource = (value: unknown, projectId: string): string | undefined => {
  const row = recordOf(value);
  if (
    row === undefined ||
    !exact(
      row,
      [
        "_id", "_creationTime", "projectId", "templateId", "templateRevision", "target",
        "resourceId", "createdBy", "updatedAt"
      ]
    ) ||
    row.projectId !== projectId ||
    !identifier(row._id) ||
    !time(row._creationTime) ||
    !identifier(row.templateId) ||
    !Number.isInteger(row.templateRevision) ||
    Number(row.templateRevision) < 1 ||
    (row.target !== "document" && row.target !== "slides") ||
    !identifier(row.resourceId) ||
    !actorIsCurrent(row.createdBy) ||
    !time(row.updatedAt)
  ) return undefined;
  const table = row.target === "document" ? "documents" : "slideDecks";
  return row.resourceId.startsWith(`${table}:`) ? row.resourceId : undefined;
};

export type CurrentThreadRow = {
  readonly _id: string;
  readonly projectId: string;
  readonly target: CommentTarget;
  readonly resolution?: { readonly by: string; readonly at: number };
};

const threadRowOf = (
  value: unknown,
  projectId: string,
  threadId: string
): CurrentThreadRow | undefined => {
  const row = recordOf(value);
  if (
    row === undefined ||
    !exact(
      row,
      ["_id", "_creationTime", "projectId", "target", "createdBy", "updatedAt"],
      ["within", "quote", "resolution"]
    ) ||
    row._id !== threadId ||
    !threadId.startsWith("commentThreads:") ||
    !identifier(threadId) ||
    row.projectId !== projectId ||
    !time(row._creationTime) ||
    !actorIsCurrent(row.createdBy) ||
    !time(row.updatedAt) ||
    (row.quote !== undefined && !text(row.quote))
  ) return undefined;
  const target = targetOf(row.target);
  if (target === undefined) return undefined;
  if (row.within !== undefined && anchorOf(row.within, target.kind) === undefined) return undefined;
  let resolution: { readonly by: string; readonly at: number } | undefined;
  if (row.resolution !== undefined) {
    const held = recordOf(row.resolution);
    if (
      held === undefined ||
      !exact(held, ["by", "at"]) ||
      !identifier(held.by) ||
      !time(held.at)
    ) return undefined;
    resolution = { by: held.by, at: held.at };
  }
  return { _id: threadId, projectId, target, ...(resolution === undefined ? {} : { resolution }) };
};

export const currentThreadIn = (
  store: Pick<StoreUnitOfWork, "read">,
  projectId: string,
  threadId: string
): CurrentThreadRow | undefined => {
  const found = store.read("commentThreads");
  if (found?.kind !== "table" || found.table !== "commentThreads") return undefined;
  const claimedThreads = found.rows.filter((row) => row._id === threadId);
  if (claimedThreads.length !== 1) return undefined;
  const thread = threadRowOf(claimedThreads[0], projectId, threadId);
  if (thread === undefined) return undefined;
  const table = tableFor(thread.target.kind);
  if (table === undefined) return undefined;
  const resources = store.read(table);
  if (
    resources?.kind !== "table" ||
    resources.table !== table ||
    resources.rows.filter((row) => row._id === thread.target.id).length !== 1 ||
    !resourceRowIsCurrent(
      resources.rows.find((row) => row._id === thread.target.id),
      table,
      projectId,
      thread.target.id
    )
  ) return undefined;
  const stages = store.read("templateStages");
  const staged = stages?.kind === "table" &&
    stages.table === "templateStages" &&
    stages.rows.some((row) => currentStageResource(row, projectId) === thread.target.id);
  return staged ? undefined : thread;
};
