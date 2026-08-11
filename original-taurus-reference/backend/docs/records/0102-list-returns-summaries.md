# Documents.List returns summaries, not bodies

`Documents.List` (and `GET /documents`) now returns a lightweight **summary** per
document — id, name, creator, timestamps — instead of full document bodies.

## Why

`List` loaded each document's stored `Base` **without folding in pending change
sets** (only `Get` does that). So `GET /documents` handed the frontend *stale*
bodies for every document at once — content missing any not-yet-rebased edit —
and shipped a heavy payload no list view needs. It was the same footgun that
broke the refresh cascade (record 0097's fix). Returning summaries removes the
possibility entirely: a listing has no body to be stale.

## What changed

- **`Document.Summary`** gains JSON tags (`id, name, creatorId, creatorName,
  createdAt, updatedAt`) — matching `Document`'s shared fields, so the frontend
  sees the same field names, just fewer of them.
- **`List(projectID) ([]Summary, error)`** projects each active document to a
  summary and no longer normalizes or returns a base.
- **`GET /documents`** returns those summaries. Content is fetched per document
  via `GET /documents/:id` (which folds in pending changes), as the frontend and
  the open-document view already do.
- **`DependentPrompts`** enumerates the summaries for ids and `Get`s each for
  resolved content (unchanged in spirit).

## Compatibility

Every existing `List` caller used only fields `Summary` already carries (id,
name, creator), so they compile and pass unchanged; the type now makes it
impossible to read a `base` from a listing. The `documents` dev-test — which
reads the id from `GET /documents` and bodies from `GET /documents/:id` — passes,
confirming nothing correctly depended on bodies in the list response.

## Verification

- Unit (`core/capability/document`, deterministic): existing list tests (id,
  creator, count) pass against the new return type.
- Live-ish (`dev-test/documents`): `GET /documents` empty case, the created
  document's id appearing in the list, and body retrieval by id all pass.
