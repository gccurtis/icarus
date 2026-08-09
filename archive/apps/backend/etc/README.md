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
