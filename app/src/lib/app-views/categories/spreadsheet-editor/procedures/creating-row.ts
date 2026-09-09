import { create } from "$capabilities/store/index.remote";
import type { TableName } from "$representation/store/tables";

export const createRow = async <T extends TableName>(
  table: T,
  fields: Record<string, unknown>
): Promise<{ id: string }> => create({ table, fields } as Parameters<typeof create>[0]);
