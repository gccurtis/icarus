# Document creator attribution + identity enrichment from real Omega data

Goals 3.1 and 3.2 from the integration plan — un-mocking two identity surfaces now that Omega
supplies the data (records 0055/0056, verified live against a fresh build of `main`).

## Goal 3.1 — Real creator attribution

The Info panel's "Created … by" was hardcoded to `mockDocumentCreator` (Maya Chen) with a Mock
badge. Omega's document now carries `creatorId`/`creatorName`, so:

- Added `creatorId`/`creatorName` to the `Doc` type and the editor session (threaded through the
  runtime's `meta` from the loaded document).
- The Info panel resolves the real creator's profile via `resolveFromUserId(creatorId, creatorName)`
  and drops the mock creator + the Mock badge.

## Goal 3.2 — Identity hover-card enrichment from GET /users/:id

`resolveFromUserId` fetched `/users/:id` but only read `{id, name}`, then filled role/description
from `MOCK_IDENTITIES` and flagged the profile `mock: true`. Omega's enriched endpoint now
returns `{id, kind, name, email, role, description, createdAt}`, so the resolver builds the
profile straight from those real fields (`mock: false`), caches the full profile, and falls back
to the mock name lookup only when the request fails. Removed the now-unused `mockDocumentCreator`
export; updated the resolver test to assert the real-field behavior.
