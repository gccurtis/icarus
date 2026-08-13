# Rich Content Runtime Objects

Each object has one instance per backend runtime. Each gets a directory holding
exactly its document, `definition.ts` — the public interface plus the class
implementing it — and `constructor.ts`, the only place that performs startup
work.

## Objects

| Object | Directory | Exported | Responsibility |
| ------ | --------- | -------- | -------------- |
| `RichContentRuntime` | [`rich-content/`](rich-content/rich-content.md) | yes | The capability's eleven public methods. Holds the store and the ID factory and delegates each method to its `runtime-api` entry. |
| `RichContentIdFactory` | [`id-factory/`](id-factory/id-factory.md) | internal | Names every content, atom, mark, and list ID, over values from Platform ID Factory. |

`RichContentRuntime` is re-exported from `index.ts`; `main.ts` holds it, and
every method on its interface has a `runtime-api` directory.

`RichContentIdFactory` is internal. It is constructed for injection into the
runtime and never leaves the capability, so it has no `runtime-api` directories
and the method-to-directory lint rule does not apply to it. Being internal is
what lets a test substitute a counting factory and assert on generated IDs.

## Relationships

```text
RichContentRuntime
├── holds RichContentIdFactory   (created during construction, never escapes)
│   └── holds IdFactory          (injected from main.ts, shared by the runtime)
└── holds RichContentStore       (created during construction, over the shared database)
```

Neither dependency is reachable from outside. A consumer that could reach the
store would be able to write content without a revision gate.

The `IdFactory` is the one dependency that arrives from outside rather than
being built here, because `main.ts` owns the single generator every capability
shares. Rich Content still owns what its IDs mean; it borrows only the values.

## Construction Order

`createRichContentRuntime(database, ids)` is the only entry point. It needs a
Kysely client from Platform Persistence and an `IdFactory` from Platform ID
Factory to already exist. In order:

1. Construct `PGliteRichContentStore` over the supplied database.
2. `await store.initialize()` — creates the `rich_content` table if absent.
3. Build the semantic ID factory over the supplied `IdFactory`.
4. Construct one `PersistedRichContentRuntime` from the two.

Step 2 is the capability's only startup side effect, and it is why the
constructor is asynchronous.
