# Backend ETC Configuration

`configuration.yaml` contains backend tuning values and other runtime magic numbers.

## Fields

- `server.host`: host interface to bind.
- `server.port`: backend HTTP port.
- `workerPool.concurrentWorkers`: maximum number of concurrently running jobs.
- `queue.serialMaxSize`: maximum pending jobs for serial work.
- `queue.concurrentMaxSize`: maximum pending jobs for concurrent work.
- `templates.maxTemplatesPerProject`: maximum live Template catalog records
  (default 500). Checked before a registration reserves its identity, so
  exceeding it fails with `400 catalog_limit_exceeded` and creates no backing
  resource.

Sections not yet documented here: `logging`, `intelligence`, `formula`,
`structuredData`, `richText`, `context`, `derivedOutputs`, `document`,
`projectId`, `userId`. Their defaults are in `DEFAULT_CONFIG` in
`src/0-utils/config/loadBackendConfig.ts`.

## Notes

- Serial queue processes exactly one job at a time.
- Concurrent queue drains into a worker pool of size `workerPool.concurrentWorkers`.
- Queue capacity errors return HTTP 429 on enqueue.
