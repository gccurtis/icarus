import type { TableName } from "$model/server/store/index.server";

export type CreateInput = {
  readonly table: TableName;
  readonly fields: unknown;
};

export type CreateResult = { readonly id: string };
