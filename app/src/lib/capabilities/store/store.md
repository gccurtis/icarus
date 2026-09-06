# Store capability

This is a transitional compatibility boundary over the representation store.
Reads are not a raw browser pass-through, and new feature mutations should use
the capability that owns their subject.

Every procedure first resolves the request's session and active project.

## Read policy

The reader uses an explicit table-and-field allowlist for current UI consumers:
Project Overview, resource names, document and deck titles, and the project
variable list. It never returns a complete representation row merely because
that row belongs to the active project.

- Allowed tables whose rows carry `projectId` return only active-project rows.
  A row or field outside that project is returned as absent (`null`).
- `projects` exposes only the active project's name and description.
- `memberships` exposes only the active project's user ids and roles. Membership
  tokens are omitted.
- `users` exposes only display names for the scoped viewer and users joined
  through those visible memberships. Auth subjects, email, and settings are
  omitted.
- `connectors` exposes identity (`name`) but never configuration or credentials.
- `externalFiles` is not readable here; the retired resource has no list or tab
  surface, while connected-source identity comes from `connectors`.
- A persona with no `projectId` is not treated as globally readable. It remains
  hidden until the representation has an explicit ownership rule for it.
- Template tables, snapshot/change-set tables, and every other table or field
  outside the allowlist fail closed and must be read through a subject
  capability. Template provenance (`templateId`) is deliberately not part of
  the document/deck/spreadsheet projection.
- Loaded members must first be records with bounded path-safe ids and finite
  creation times. Ambiguous duplicate ids and rows with missing or malformed
  required projected fields are omitted. Composite values are copied through a
  bounded walk; represented actors and resource links must have their exact
  public shape, so an extra nested field cannot ride through an allowed root.

Table and row reads are projected on the server; callers never receive private
fields and then filter them in the browser. `_id` and `_creationTime` accompany
each projected row because the current list procedures use row identity and
activity age.

## Write policy

Generic `create`, `update`, and `remove` remain available for compatibility.
The Template library and Project Overview do not use them: their typed subject
capabilities establish scope, invariants, versioning, and cache refreshes before
they write. New feature code should follow that boundary. Removing or further
restricting the compatibility procedures is a separate migration because stale
clients may still call their remote API.
