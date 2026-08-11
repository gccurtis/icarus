# Identity profile enrichment (1b)

Extends `GET /users/:userID` to return a richer identity profile including
email, role, kind, description, and account creation date. Previously the
endpoint only returned `{id, name}` — everything else was mock data on the
Alpha side.

## What changed

- **`PublicUser`** — expanded from `{ID, Name}` to
  `{ID, Kind, Name, Email, Role, Description, CreatedAt}`. `Kind` is always
  `"person"` for real users. `Role` comes from the user's membership in the
  target project. `Email` was already stored on `User` but was deliberately
  omitted from the safe projection — now exposed because the endpoint is
  already gated on project membership.

- **`PublicUserInProject`** — now returns the membership from the check
  instead of discarding it, so `Role` can be populated. All other fields come
  from `UserByID` and a computed default description.

- **User handler** — `publicUserJSON` expanded to match, `Get()` maps all
  fields including a formatted `createdAt` string.

- **Transport test** — `TestUnifiedResourceLifecycle` assertion updated: the
  email `reader@resources.test` is now expected to appear in the response
  (previously the test asserted it was absent).

- **Access test** — `TestPublicUserInProjectIsMembershipBound` now verifies
  all new fields: kind, email, role, description, createdAt.

## Why

Alpha's identity resolution (`systems/identity-directory/`) calls
`GET /users/:userID` and falls back to `MOCK_IDENTITIES` for every field
except `id` and `name`. By enriching the endpoint, Alpha can read real
profile data and stop falling back to mock identities for real users.
Persona identities remain future work.
