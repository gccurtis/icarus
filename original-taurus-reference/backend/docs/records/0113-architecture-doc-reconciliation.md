# 0113 — Architecture doc reconciliation (DOC-1)

Closes the documentation half of the architecture review
([`issues-and-gaps.md`](../architecture/issues-and-gaps.md)). No code changed.

## Why

The review found two documentation problems. First, the `docs/architecture/`
deep-dives had accurate conceptual prose sitting on **stale structural
inventories**: the codebase had grown from ~10 to ~20 capabilities and the tables
had not followed. Second, only 10 of the 20 capabilities had a document at all, so
half the domain was undescribed.

The decision taken in [0108](0108-runtime-model-docs-and-companion-policy.md) was
to archive what was fully superseded and *patch* what was merely behind — the
mechanics in these docs are correct and worth keeping; only the inventories had
drifted.

## `configuration.md` — settings table rebuilt against `config.go`

- **Removed a phantom setting.** `documents.layout.max_row_height_increase`
  (documented with a default of 144) does not exist in `config.DocumentLayout` and
  never did. A documented knob that isn't real is worse than an undocumented one.
- **Added the missing real settings:** `documents.layout.char_width`, the whole
  `documents.prompt` block (plan/synthesis casts, retrieval top-k, max queries,
  and the prompt templates), `documents.trash_retention`, `logging.dir`,
  `agents.web`, and `agents.attachments.max_directory_files`.

## `transport.md` — the third dispatch mode, and ~30 missing routes

This was the worst drift, because the doc described dispatch as a **sync/async
binary** and presented a stale `operationSync` snippet as the source of truth.

- Documented **`dispatchSerial`**, the third mode: `adaptSerialScoped` takes a
  per-key lock from `dispatch.KeyedMutex` (keyed by document id) and answers
  synchronously. Recorded that it is a *contention optimisation* — the
  cross-process authority remains the revision CAS in the store — so nobody reads
  it as the correctness mechanism.
- Corrected the snippet, which labelled `documents.append_changes`, `undo`, and
  `redo` as `dispatchSync` when the code classifies all three as `dispatchSerial`.
- Regenerated the route table from `transport.New`, adding the ~30 live routes it
  omitted (organizations, connectors, contexts, comments, files,
  collaboration/presence, references/backlinks, notifications, resource
  attributes/access, generate, document import/export/templates/windowed reads,
  identity resolve, persona versions).
- Documented the two security-relevant middlewares it never mentioned:
  `documentAccessGuard` (per-document access scope) and `sessionActivity`.

## `persistence.md` — the port table, and the split

- The "one store, every interface" table listed ~9 port domains against a store
  that backs ~19. It now enumerates them all **and maps each port to the
  `sqlite_<capability>.go` file that implements it** — so the table doubles as the
  index to the split from [0112](0112-sqlite-per-capability-split.md).
- Recorded the `RebaseDocument` monotonic guard
  ([0109](0109-rebase-watermark-guard-and-document-index.md)), the jobs
  `ReapStale` crash-recovery reaper
  ([0110](0110-job-crash-recovery-and-reaper-lifecycle.md)), and the new
  `idx_documents_project`.

## Ten new capability documents

`docs/architecture/capabilities/` now mirrors `core/capability/` **1:1**. Added:
`chat`, `comment`, `connector`, `contexts`, `file`, `notification`,
`organization`, `presence`, `reference`, `workspace`. Each covers what the
capability is, its model, its ports and who satisfies them in wiring, its
operations, and how it stays decoupled.

Writing them surfaced several facts worth having written down:

- **`connector`** — `connectorProviderFactory` always returns the *HTTP* provider,
  so even the `local-folder` subkind is served by the external
  `cmd/connector-watcher` over HTTP (deliberate: it is the shape a real cloud
  provider will take). The in-process `NewLocalFolderProvider` is used only by the
  watcher and tests.
- **`presence`** — has no `handlers/presence`; it is served through
  `handlers/collaboration`, and keys its map by document id alone (project scoping
  comes from the handler's prior document read). It is one of three genuinely
  stateful capabilities, and is distinct from *both* the auth cookie and the
  `session` capability — three different things called "session" or "presence".
- **`file`** — `List` exists on the service but has no HTTP route; it is
  service-only, exercised by tests.
- Meta-model deviations: `chat` and `reference` keep their in-memory stores inline
  rather than in a `memory.go`; `notification` and `presence` declare no ports at
  all, and the consumers that need them (agent's `Notifier`, resource's
  `OrgMembershipResolver`) are satisfied structurally with no wiring adapter.

## Indexes

- `docs/architecture/README.md` — the capability table now lists all 20, flags the
  three stateful ones, and points at the meta-model section of the runtime model.
- `docs/orientation/README.md` — kept as the agent-onboarding path (it is not
  duplicated runtime narrative, so it was not demoted to an index as the review
  first suggested). Its stale inventories are fixed: the capability table now
  lists 20, the repository map names all 20 capability packages plus
  `platform/dispatch`, `platform/telemetry`, and `integration/context/web`, and the
  documentation-layers section points at the runtime model and the issues register.
