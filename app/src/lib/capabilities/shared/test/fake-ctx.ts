/**
 * The `ctx` every capability's operation tests run against — an in-memory `db`
 * with just enough of Convex's interface to exercise a handler without a
 * deployment.
 *
 * `withIndex` ignores the index name and filters on the predicates instead, so a
 * test proves what a handler *asked* for, never that an index exists. That the
 * right index exists is a schema assertion, and it is made against `schema.ts`.
 */
export function fakeCtx() {
  const rows = new Map<string, Record<string, unknown>>();
  const log: Record<string, unknown>[] = [];
  const blobsDeleted: string[] = [];
  let n = 0;

  /** Convex indexes a nested field by its dotted path, and so does this. */
  const at = (doc: Record<string, unknown>, path: string): unknown =>
    path
      .split(".")
      .reduce<unknown>(
        (value, key) => (value as Record<string, unknown> | undefined)?.[key],
        doc
      );

  const ctx = {
    rows,
    log,
    blobsDeleted,
    // Stored bytes have no contents here: what a handler must get right is
    // taking them with the row it deletes, which is what this records.
    storage: {
      delete: async (id: string) => void blobsDeleted.push(id)
    },
    db: {
      insert: async (table: string, doc: Record<string, unknown>) => {
        const id = `${table}:${++n}`;
        if (table === "activity") log.push(doc);
        // Convex stamps `_creationTime` on every row, so anything reading one
        // back — a comment's time, an ordering — must find it here too.
        rows.set(id, { _creationTime: Date.now(), ...doc, _table: table });
        return id;
      },
      get: async (id: string) =>
        rows.has(id) ? { _id: id, ...rows.get(id) } : null,
      // A stored id names the table it was minted for, which is what lets a
      // handler holding `(kind, id)` refuse an id belonging to another table.
      normalizeId: (table: string, id: string) => (id.startsWith(`${table}:`) ? id : null),
      patch: async (id: string, fields: Record<string, unknown>) => {
        rows.set(id, { ...rows.get(id), ...fields });
      },
      replace: async (id: string, doc: Record<string, unknown>) => {
        const { _creationTime, _table } = rows.get(id) ?? {};
        rows.set(id, { _creationTime, ...doc, _table });
      },
      delete: async (id: string) => void rows.delete(id),
      query: (table: string) => {
        const all = [...rows.entries()]
          .filter(([, d]) => d._table === table)
          .map(([id, d]) => ({ _id: id, ...d }));
        const chain = (found: Array<Record<string, unknown>>) => ({
          withIndex: (_name: string, fn?: (q: unknown) => unknown) => {
            const preds: Array<(d: Record<string, unknown>) => boolean> = [];
            const q = {
              eq: (f: string, val: unknown) => {
                preds.push((d) => at(d, f) === val);
                return q;
              },
              gt: (f: string, val: number) => {
                preds.push((d) => (at(d, f) as number) > val);
                return q;
              }
            };
            fn?.(q);
            return chain(found.filter((d) => preds.every((p) => p(d))));
          },
          // Insertion order stands in for `_creationTime`, which is what Convex
          // orders an index range by.
          order: (direction: "asc" | "desc") =>
            chain(direction === "desc" ? [...found].reverse() : found),
          collect: async () => found,
          first: async () => found[0] ?? null,
          unique: async () => found[0] ?? null
        });
        return chain(all);
      }
    }
  };
  return ctx;
}
