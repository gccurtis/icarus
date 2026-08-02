import type {
  TemplateCommittedFact,
  TemplateFactKind,
  TemplateRecord,
  TemplateRecordState
} from "../domain/model.js";

export type SQLiteRow = Record<string, unknown>;

export const encodeJson = (value: unknown): Buffer =>
  Buffer.from(JSON.stringify(value), "utf8");

export const decodeJson = <T>(value: unknown): T => {
  const text = Buffer.isBuffer(value)
    ? value.toString("utf8")
    : typeof value === "string"
      ? value
      : "";
  return JSON.parse(text) as T;
};

export const rowToTemplate = (row: SQLiteRow): TemplateRecord => ({
  id: row.id as string,
  kind: row.kind as string,
  resourceId: row.resource_id as string,
  ...((row.description as string | null) !== null
    ? { description: row.description as string }
    : {}),
  state: row.state as TemplateRecordState,
  createdAt: row.created_at as string,
  ...((row.deleted_at as string | null) !== null
    ? { deletedAt: row.deleted_at as string }
    : {})
});

export const rowToFact = (row: SQLiteRow): TemplateCommittedFact => ({
  factId: row.fact_id as string,
  kind: row.kind as TemplateFactKind,
  templateId: row.template_id as string,
  resourceKind: row.resource_kind as string,
  resourceId: row.resource_id as string,
  ...((row.actor_id as string | null) !== null
    ? { actorId: row.actor_id as string }
    : {}),
  occurredAt: row.occurred_at as string
});
