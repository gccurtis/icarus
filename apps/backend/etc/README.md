# Backend ETC Configuration

`configuration.yaml` contains backend tuning values and other runtime magic numbers.

## Fields

- `server.host`: host interface to bind.
- `server.port`: backend HTTP port.
- `workerPool.concurrentWorkers`: maximum number of concurrently running jobs.
- `queue.serialMaxSize`: maximum pending jobs for serial work.
- `queue.concurrentMaxSize`: maximum pending jobs for concurrent work.

## Notes

- Serial queue processes exactly one job at a time.
- Concurrent queue drains into a worker pool of size `workerPool.concurrentWorkers`.
- Queue capacity errors return HTTP 429 on enqueue.
