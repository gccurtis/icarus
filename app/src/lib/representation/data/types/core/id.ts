/** A row id, branded by its table. A plain string at runtime. */
export type Id<Table extends string> = string & { readonly __table: Table };

/** What every row carries, whatever its table. No table repeats these. */
export type Row<Table extends string> = {
  readonly _id: Id<Table>;
  readonly _creationTime: number;
};
