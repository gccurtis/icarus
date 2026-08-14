# Name Manager Runtime Objects

Name Manager has one runtime object, and one instance of it per backend runtime.

| Object | Directory | Exported | Responsibility |
| ------ | --------- | -------- | -------------- |
| `NameManager` | [`name-manager/`](name-manager/name-manager.md) | yes | Holds the runtime's named-variable catalog and delegates every method to its `runtime-api` entry |

`NameManager` is exported: [`index.ts`](../index.ts) re-exports the interface and
its constructor, the runtime constructs one, and every method on the interface has
a directory under [`runtime-api/`](../runtime-api/runtime-api.md).

No internal object exists. Admission is a set of functions over their arguments,
not a collaborator that needs constructing, so there is nothing to inject.

## Construction Order

`createNameManager(logger)` requires no database and no configuration, so
`build-runtime.ts` may construct it at any point after observability exists.
