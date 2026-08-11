# Batch identity resolver

One project-authorized endpoint turns a mixed list of identity references into
public profile cards, so a client keeps a single deduplicated avatar/name/hover
cache instead of a different shape per feature (presence, comments, history,
tasks, activity).

## Endpoint

**`POST /projects/:projectID/identities/resolve`**
`{ identities: [{ kind: "user"|"persona", id }] }` →
`{ profiles: [{ id, kind, name, email, avatarUrl, role, description, createdAt }], unavailable: [{kind,id}] }`.

- **Project-authorized** — the caller must be a member of `:projectID`
  (`MembershipRole` → `403` otherwise).
- **Users** resolve through the existing `PublicUserInProject` public-profile
  projection (name, avatar, project role, email per the same member-visible
  policy as the members endpoint). A user who is not a member of the project is
  reported in `unavailable`, not resolved.
- **Personas** resolve through the persona capability, scoped to the project
  (name + description; no email/role/avatar). A missing persona is `unavailable`.
- Optional fields (`email`, `avatarUrl`, `role`, `createdAt`) are **nullable** —
  present only when the source and policy provide them — so every caller tolerates
  their absence. References are **deduplicated**, and the batch is bounded
  (`MaxIdentitiesPerRequest` = 200).

## Where

A new `identity` handler composes the **access** and **persona** capabilities at
the handler layer — the two capabilities stay independent of each other (the
composition lives in the composition/handler boundary, not inside a capability).
No new store or Options field: it reuses `Access` + `Personas`.

## Tests

- Dev-test (`dev-test/identities`): resolve a mixed batch — a user (with avatar +
  role) plus the General persona plus an unknown user — and confirm two profiles,
  the unknown in `unavailable`, correct kinds/avatar/role; duplicate references
  resolve once; a non-member gets `403`.

## Settled

- One batched, project-authorized resolver over discriminated `user`/`persona`
  references. ✓
- Public-safe, nullable optional fields; deleted/inaccessible → `unavailable`. ✓
- Personas are a first-class identity source alongside users. ✓
- Composition at the handler layer keeps `access` and `persona` independent. ✓
