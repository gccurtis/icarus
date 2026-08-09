import type {
  TemplateCommandType,
  TemplateCommittedTransaction,
  TemplateContextBindings,
  TemplateTransactionKind,
  TemplateOrigin,
  TemplateRecord
} from "../domain/model.js";
import type { TemplateCommandReceipt } from "../ports/templateStore.js";

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
  name: row.name as string,
  ...((row.description as string | null) !== null
    ? { description: row.description as string }
    : {}),
  contextBindings: decodeJson<TemplateContextBindings>(row.context_bindings_json),
  revision: Number(row.revision),
  createdAt: row.created_at as string,
  updatedAt: row.updated_at as string
});

export const rowToReceipt = (row: SQLiteRow): TemplateCommandReceipt => ({
  requestId: row.request_id as string,
  requestDigest: row.request_digest as string,
  commandType: row.command_type as TemplateCommandType,
  result: decodeJson<unknown>(row.result_json),
  createdAt: row.created_at as string
});

export const rowToTransaction = (row: SQLiteRow): TemplateCommittedTransaction => ({
  sourceTransactionId: row.source_transaction_id as string,
  kind: row.transaction_kind as TemplateTransactionKind,
  templateId: row.template_id as string,
  resourceKind: row.resource_kind as string,
  resourceId: row.resource_id as string,
  ...((row.actor_id as string | null) !== null
    ? { actorId: row.actor_id as string }
    : {}),
  origin: row.origin as TemplateOrigin,
  occurredAt: row.occurred_at as string
});
