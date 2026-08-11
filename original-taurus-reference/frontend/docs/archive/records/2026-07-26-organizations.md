# 2026-07-26 — G4 part 2: Organizations

Completes **G4**. Part 1 added resource pinning + a member-scoped access editor that
round-tripped `orgIds` untouched; this part adds the greenfield **Organizations** feature
— a data module + a user-menu manager — and extends the resource access editor to grant
access by organization.

Contract confirmed against Omega source (`core/handlers/organization/organization.go`,
`core/capability/organization/organization.go`, `core/transport/transport.go`):
organizations are **user-scoped** (registered on the `gated`/`requireUser` group, not the
project group — they span projects), gated on `opts.Organizations != nil`. Wire shapes are
`orgJSON {id,name,role?,createdAt,updatedAt}` and `memberJSON {userId,role}`.

## New `organizations` system + data boundary

```ts
// systems/organizations/api.ts — the full capability surface
loadOrganizations()                     // GET  /organizations            → { organizations: [...] }
createOrganization(name)                // POST /organizations            → orgJSON (role: owner)
renameOrganization(orgId, name)         // PATCH /organizations/:id       → orgJSON (role omitted)
fetchOrgMembers(orgId)                  // GET  /organizations/:id/members
addOrgMember(orgId, userId, role)       // POST /organizations/:id/members  { userId, role }
setOrgMemberRole(orgId, userId, role)   // PATCH .../members/:userId  (204)
removeOrgMember(orgId, userId)          // DELETE .../members/:userId (204)
```

A new `systems/organizations` module (types/store/api/index) plus a `data/organizations.ts`
boundary. Everything the capability exposes is wired — no endpoint left mocked. Two contract
subtleties are handled explicitly: the list/members responses are **wrapped**
(`{organizations}` / `{members}`), and **rename omits the caller's role**, so
`renameOrganization` updates only name + timestamp and keeps the role already in the store.
The store is user-scoped (loaded from the user menu, not on project switch).

## Organizations manager (user menu)

```svelte
<!-- ShellTopBar account menu -->
{ label: 'Organizations', onselect: () => (organizationsOpen = true) }
```

A new `OrganizationsDialog` (master-detail): the left pane lists the caller's orgs with role
badges and a create field; the right pane manages the selected org — rename (owner/admin) and
members. Since Omega's `memberJSON` carries only `userId` + `role`, member rows resolve the id
to a real name via the identity directory's `resolveFromUserId` (the same cached
`GET /users/:id` used for document attribution). Role changes and removal use the 204 routes;
members are added by user id.

Known limitation (surfaced, not hidden): Omega's add-member endpoint takes a **user id**, and
there is no email→id lookup, so the invite field asks for a user id with an inline note. An
id-resolving picker is a future refinement.

## Resource access editor grants by organization

```svelte
<!-- ResourceSettingsDialog.svelte — Restricted access now lists orgs alongside members -->
{#if $organizations.length}
  Organizations with access:
  {#each $organizations as org}
    <input type="checkbox" checked={orgIds.includes(org.id)} onchange={() => toggleOrg(org.id)} … />
  {/each}
{/if}
```

The access editor (documents, owner-only) loads the caller's orgs on open and renders them as
a checklist beside the member allow-list. `orgIds` — previously round-tripped untouched — is
now editable, and `accessChanged` compares both the user set and the org set so **Save access**
enables on either change. This closes the loop: an owner can scope a document to specific
project members and/or whole organizations, exactly matching Omega's `AccessScope`.

## Verification

- `pnpm check` — 0 errors, 0 warnings. `pnpm test` — 271 passed (+6 organization-client tests
  covering the wrapped list, the role-preserving rename, and the member routes/bodies).
- Contract matched to Omega source before wiring (user-scoped routes, wrapped responses,
  role-omitting rename, `{userId, role}` add body).
- Companions byte-verified for all eight new/changed files (the new system is fully companioned).
- Live UI E2E pending (no headless Chrome). To try it on `:8443`: open **Organizations** from the
  account menu, create one, add a member by id; then in a document's settings, set **Restricted**
  and tick the org.
