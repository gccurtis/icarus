# Backend ETC Configuration

`configuration.yaml` contains backend tuning values and other runtime magic numbers.

## Fields

- `server.host`: host interface to bind.
- `server.port`: backend HTTP port.
- `workerPool.concurrentWorkers`: maximum number of concurrently running jobs.
- `queue.serialMaxSize`: maximum pending jobs for serial work.
- `queue.concurrentMaxSize`: maximum pending jobs for concurrent work.
- `retention.revisionRetentionDays`: age at which superseded revisions are
  pruned and logically deleted resources become eligible for physical purge.
- `retention.sweepIntervalHours`: interval between serial retention sweeps.

### `structuredAnalytic`

How big a saved analytic *recipe* may be. These bound the definition, not the
data it reads — data size is enforced by Formula's own `formula.max*` limits, so
nothing here duplicates them. Every value is a positive integer, and an omitted
key falls back to its default rather than failing to load.

| Field | Default | Bounds |
| --- | ---: | --- |
| `maxInputs` | 8 | project data inputs in one definition |
| `maxJoinKeys` | 8 | equality keys on a single join |
| `maxPlacements` | 32 | Rows and Columns placements **together** |
| `maxFilters` | 32 | filters in one definition |
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
