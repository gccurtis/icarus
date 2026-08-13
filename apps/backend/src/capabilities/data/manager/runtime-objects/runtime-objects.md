# Data Manager Runtime Objects

Data Manager has one runtime object, and one instance of it per backend runtime.

| Object | Directory | Exported | Responsibility |
| ------ | --------- | -------- | -------------- |
| `DataManager` | [`manager/`](manager/manager.md) | yes | Holds the runtime's named-variable catalog and delegates every method to its `runtime-api` entry |

`DataManager` is exported: [`index.ts`](../index.ts) re-exports the interface and
its constructor, `main.ts` constructs one, and every method on the interface has
a directory under [`runtime-api/`](../runtime-api/runtime-api.md).

No internal object exists. Admission is a set of functions over their arguments,
not a collaborator that needs constructing, so there is nothing to inject.

## Construction Order

`createDataManager()` takes no argument and requires nothing to exist first — no
database, no configuration, no logger. `main.ts` may construct it at any point in
startup.
