# Activity API

Lives at `api/api.md`.

| Directory | Function | Kind |
| --- | --- | --- |
| [`list/`](list/list.md) | `list` | query — one project's log, newest first |
| [`shared/`](shared/shared.md) | — | `record`, which every other capability calls |

## Why `record` is in `shared/` rather than `api/record/`

`api/` and the deployment door must name the same set of functions, and `record`
is not one: it is never registered, because a log a client can append to is not
evidence of anything. An `api/record/` directory would therefore fail lint as
"no function named 'record' is registered", and rightly — the message is exactly
what is true.

`shared/` is the ordinary answer for a procedure a second caller needs, and the
second caller here is every capability that writes something worth an entry. That
it has no callers inside this capability is unusual, and matches `access`, whose
`resolveScope` is called only from the deployment root.
