# Connector resource kind (live-document Slice A)

The first slice of the live-document program (design:
[`docs/superpowers/specs/2026-07-26-live-document-connectors-design.md`](../superpowers/specs/2026-07-26-live-document-connectors-design.md);
plan: [`docs/superpowers/plans/2026-07-26-connector-resource-kind.md`](../superpowers/plans/2026-07-26-connector-resource-kind.md)).
It adds a `connector` resource kind — a persisted, project-scoped external-source
binding — without yet syncing anything into the knowledge lattice (that is
Slice B).

## What changed

- **`connector` joins the resource vocabulary.** `resource.KindConnector` is added
  to the closed `Kind` set and `knownKinds`, so it parses, registers, and can
  appear in `availableKinds`.
- **A new `connector` capability** (`core/capability/connector`) owns the record:
  `Connector{ID, ProjectID, Name, SubKind, Path, CreatorID, timestamps}`, a closed
  `SubKind` vocabulary whose first value is `local-folder`, a `Store` port, an
  in-memory store, and a `Connectors` service (create / get / summaries /
  configure / rename / delete). The capability owns only the record and its config
  — it does **not** read the filesystem or talk to any provider; that is Slice B.
- **Persistence.** The SQLite store gains a `connectors` table and the five
  `Store` methods, so a connector survives a restart.
- **Catalog integration.** `connectorResourceFamily` (in `core/wiring`) adapts the
  connector service to `resource.Family`, so connectors list, get, rename, and
  delete through the same unified catalog as documents — the `connector` and
  `resource` capabilities stay independent (composition lives in wiring).
- **Connector-specific routes.** The generic `POST /resources {kind,name}` cannot
  carry a provider subkind or path, so a small connector handler serves
  `POST /connectors` (name + subkind), `GET /connectors/:id`, and
  `PUT /connectors/:id/config` (absolute path required for `local-folder`),
  registered when `Options.Connectors` is set.

## Why a subkind, and why one kind

A connector is one resource *kind* carrying a provider *subkind*, not a kind per
provider. The first subkind (`local-folder`) is a complete, honest implementation
— a mutable local stand-in for real providers (Google Drive, …), which become
later subkinds behind the same provider contract in Slice B. Keeping them one kind
means the catalog, access scoping, and every downstream consumer treat all
connectors uniformly.

## Tests

- Unit (`core/capability/connector`): create defaults + ID assignment, bad
  name/subkind rejection, configure sets path and rejects a relative path, and
  get/rename/delete with project isolation.
- Persistence (`core/platform/storage/sqlite`): a connector round-trips across a
  reopen.
- Catalog (`core/wiring`): a connector created through the resource catalog lists,
  gets, and reports `connector` in `availableKinds`.
- Transport (`core/transport`): create + configure (relative path → 400) + get.
- Dev-test (`dev-test/connectors`, always runs — no model): the full lifecycle,
  including rename/delete through the generic resource surface and a 404 after
  delete.

## Settled

- `connector` is a first-class, persisted resource kind with a provider subkind. ✓
- `local-folder` is the first subkind; real providers are later subkinds, deferred. ✓
- Catalog integration via a family adapter keeps `connector`/`resource` independent. ✓
- Subkind + provider config are served outside the generic catalog. ✓
- No lattice sync yet — that is Slice B. (Satisfies design acceptance criterion 1.)
