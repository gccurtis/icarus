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
  let n = 0;
  const ctx = {
    rows,
    log,
    db: {
      insert: async (table: string, doc: Record<string, unknown>) => {
        const id = `${table}:${++n}`;
        if (table === "activity") log.push(doc);
        rows.set(id, { ...doc, _table: table });
        return id;
      },
      get: async (id: string) =>
        rows.has(id) ? { _id: id, ...rows.get(id) } : null,
      patch: async (id: string, fields: Record<string, unknown>) => {
        rows.set(id, { ...rows.get(id), ...fields });
      },
      replace: async (id: string, doc: Record<string, unknown>) => {
        rows.set(id, { ...doc, _table: rows.get(id)?._table });
      },
      delete: async (id: string) => void rows.delete(id),
      query: (table: string) => {
        const all = [...rows.entries()]
          .filter(([, d]) => d._table === table)
          .map(([id, d]) => ({ _id: id, ...d }));
        const api = {
          withIndex: (_name: string, fn?: (q: unknown) => unknown) => {
            const preds: Array<(d: Record<string, unknown>) => boolean> = [];
            const q = {
              eq: (f: string, val: unknown) => {
                preds.push((d) => d[f] === val);
                return q;
              },
              gt: (f: string, val: number) => {
                preds.push((d) => (d[f] as number) > val);
                return q;
              }
            };
            fn?.(q);
            const rowsOut = all.filter((d) => preds.every((p) => p(d)));
            return { ...api, collect: async () => rowsOut, unique: async () => rowsOut[0] ?? null };
          },
          collect: async () => all,
          unique: async () => all[0] ?? null
        };
        return api;
      }
    }
  };
  return ctx;
}
