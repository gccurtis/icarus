# Settings API

Lives at `api/api.md`.

One directory per public function. Each holds the entry that owns that function's whole
procedure, and a document carrying its procedure tree.

| Directory | Function | Kind |
| --- | --- | --- |
| [`list/`](list/list.md) | `list` | query — reads one project's settings |
| [`set/`](set/set.md) | `set` | mutation — writes one |

There is no `shared/`. Nothing is used by both functions yet: `canonicalKey` is model rather
than procedure and lives in `types/`, and the two share an index but not a query. A procedure
is promoted to `shared/` when a second function needs it *and* it preserves an invariant
spanning them, not merely because two call sites want the same lines.

## These are handlers, not registrations

Each entry takes a Convex `QueryCtx` or `MutationCtx` as its first parameter and its own
input as the rest. It is plain TypeScript — nothing here calls `query()` or `mutation()`.

The registration lives in
[`src/convex/capabilities/settings.ts`](../../../../convex/capabilities/settings.ts),
because a module only becomes a callable Convex function by sitting under the functions
directory, and because a file's path there *is* its public name. Keeping the procedures out
of that directory is what stops them becoming public API by accident.

The `ctx` parameter is what replaces the old `Scope` first parameter. It carries the database
handle and, once the scope gate exists, the resolved project and user.
