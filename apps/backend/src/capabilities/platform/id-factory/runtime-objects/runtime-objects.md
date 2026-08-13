# ID Factory Runtime Objects

Lives at `runtime-objects/runtime-objects.md`.

Each object has one instance per backend runtime. Each gets a directory holding
exactly its document, `definition.ts` — the public interface plus the class
implementing it — and `constructor.ts`, the only place that performs startup
work.

## Objects

| Object | Directory | Exported | Responsibility |
| ------ | --------- | -------- | -------------- |
| `IdFactory` | [`id-factory/`](id-factory/id-factory.md) | yes | Returns one collision-resistant identifier value per call. |

`IdFactory` is re-exported from `index.ts`; `main.ts` holds it and passes it to
the capabilities that allocate identity, and its one interface method has a
`runtime-api` directory.

The capability has no internal object. There is nothing for one to hide.

## Construction Order

`createIdFactory()` requires nothing and can fail in no way, so `main.ts` may
construct it anywhere before the first capability that needs one. Constructing
it early — beside configuration, ahead of the database — keeps the startup
sequence readable: every capability that takes an `IdFactory` then receives the
same instance, and no ordering question arises.
