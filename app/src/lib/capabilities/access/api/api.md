# Access API

Lives at `api/api.md`.

| Directory | Function | Kind |
| --- | --- | --- |
| [`seed/`](seed/seed.md) | `seed` | mutation — creates the development rows |
| [`shared/`](shared/shared.md) | — | procedures more than one caller needs |

`shared/` here holds `resolveScope`, which is unusual: its two callers are
`projectQuery` and `projectMutation` rather than two functions of this
capability. It is still a promotion by the ordinary rule — a second caller, and
an invariant spanning them — the callers simply live in the deployment root
because that is where scoping is applied.
