# Configuration Runtime API

Lives at `runtime-api/runtime-api.md`.

One directory per public method on `Configuration`, named after the method in
kebab-case, containing an entry file of the same name that owns that method's
complete orchestration.

## Methods

| Method | Directory | Execution | Description |
| ------ | --------- | --------- | ----------- |
| `get` | [`get/`](get/get.md) | accessor | Resolves a dot-separated key path against the loaded snapshot. |

Every method on the exported interface appears here, and every directory under
`runtime-api/` appears as a method.

## Shared Procedures

No procedure has been promoted to `shared/`. There is one method. The only rule
two files must agree on — what counts as a mapping — lives with the type it
narrows, in
[`types/configuration-object.ts`](../types/configuration-object.ts), because the
constructor needs it as much as the method does.
