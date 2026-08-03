# Backend ETC Configuration

`configuration.yaml` contains backend tuning values and other runtime magic numbers.

## Fields

- `server.host`: host interface to bind.
- `server.port`: backend HTTP port.
- `server.maxBodyBytes`: largest accepted request body. Effectively unbounded by
  default (2 GiB − 1), which overrides Fastify's 1 MiB default. Unbounded on
  purpose: a rejected request is logged with its payload verbatim, and a cap
  would silently stop that at the size where the payload matters most. A body
  over 1 MiB is still logged as `http.request.body-large` — it is allowed, and
  it is an anomaly worth seeing.
- `workerPool.concurrentWorkers`: maximum number of concurrently running jobs.
- `queue.serialMaxSize`: maximum pending jobs for serial work.
- `queue.concurrentMaxSize`: maximum pending jobs for concurrent work.
- `retention.revisionRetentionDays`: age at which superseded revisions are
  pruned and logically deleted resources become eligible for physical purge.
- `retention.sweepIntervalHours`: interval between serial retention sweeps.

### `structuredAnalytic`

How big a saved analytic *recipe* may be. These bound the definition, not the
data it reads — data size is enforced by Formula's own `formula.max*` limits, so
nothing here duplicates them. An omitted key falls back to its default rather
than failing to load.

Every value must be a positive safe integer. The loader itself only rejects
non-numbers, non-finite values, and values below 1 — a fractional `32.5` loads —
so startup calls `validateAnalyticLimits`, which enforces whole numbers and the
complete key set, and fails the process rather than the request.

| Field | Default | Bounds |
| --- | ---: | --- |
| `maxInputs` | 8 | project data inputs in one definition |
| `maxJoinKeys` | 8 | equality keys on a single join |
| `maxPlacements` | 32 | Rows and Columns placements **together** |
| `maxFilters` | 32 | filters in one definition |
| `maxFilterValues` | 256 | values in one `in` list |
| `maxScalarBytes` | 4096 | one filter literal: a text value, or a rational's digit string |
| `maxSorts` | 8 | sort entries in one definition |
| `maxTitleBytes` | 4096 | UTF-8 size of the title |
| `maxDescriptionBytes` | 4096 | UTF-8 size of the description |
| `maxNameBytes` | 256 | any single name: input, field, alias, placement id |

There is deliberately **no per-project catalog cap**. That was removed from
Templates and deferred to a global resource-quota policy; adding one back here
would reintroduce exactly what that decision retired.

Sections not yet documented here: `logging`, `intelligence`, `formula`,
`structuredData`, `richText`, `context`, `derivedOutputs`, `document`,
`projectId`, `userId`. Their defaults are in `DEFAULT_CONFIG` in
`src/0-utils/config/loadBackendConfig.ts`.

## Notes

- Serial queue processes exactly one job at a time.
- Concurrent queue drains into a worker pool of size `workerPool.concurrentWorkers`.
- Queue capacity errors return HTTP 429 on enqueue.
- After HTTP binds, the resource-retention scheduler runs one immediate sweep and
  then repeats at `retention.sweepIntervalHours`. Capabilities run sequentially;
  each purge/prune failure is logged and does not stop later capabilities.
- Shutdown clears the recurring retention timer and waits for an active sweep.
- Revision retention does not prune Activity, transaction outboxes, command
  receipts, or delegated claims, and never runs SQLite `VACUUM`.
