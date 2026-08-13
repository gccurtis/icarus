# ID Factory Runtime API

Lives at `runtime-api/runtime-api.md`.

One directory per public method on `IdFactory`, named after the method in
kebab-case, containing an entry file of the same name that owns that method's
complete orchestration.

## Methods

| Method | Directory | Execution | Description |
| ------ | --------- | --------- | ----------- |
| `create` | [`create/`](create/create.md) | accessor | Returns one collision-resistant identifier value. |

Every method on the exported interface appears here, and every directory under
`runtime-api/` appears as a method. `pnpm lint` enforces both directions. There
is exactly one of each, and the capability is not expected to grow more: a
second method would mean a second scheme, and choosing between schemes at the
call site is the semantics this capability declines to own.

## Shared Procedures

No procedure has been promoted to `shared/`. There is one method.
