# Configuration Runtime Objects

Lives at `runtime-objects/runtime-objects.md`.

Each object has one instance per backend runtime. Each gets a directory holding
exactly its document, `definition.ts` — the public interface plus the class
implementing it — and `constructor.ts`, the only place that performs startup
work.

## Objects

| Object | Directory | Exported | Responsibility |
| ------ | --------- | -------- | -------------- |
| `Configuration` | [`configuration/`](configuration/configuration.md) | yes | Holds the frozen snapshot of merged YAML sections and answers key lookups against it. |

## Construction Order

`createConfiguration()` requires nothing but the filesystem, so `main.ts`
constructs it first. Observability, persistence, and the web server are all
configured from the snapshot it returns.
