# 2026-07-26 — G4 part 1: resource pinning + access scope

Un-mocks the two mock controls in the resource settings dialog — **Visibility** and the
**Pin** switch — against Omega's real resource-attribute routes. Organizations (which feed
`access.orgIds`) are the second half of G4 and land next; this slice edits access by
**project member**, preserving any org grants untouched.

Contract confirmed against Omega source (`core/handlers/resource/resource.go`,
`core/capability/resource/{access,attributes,resource}.go`, `core/transport/transport.go`):
`pinned` and `access` ride on the resource **summary** payload (no GET), and both are
written **PATCH-only** — `/attributes` (`{pinned}`, project-write role) and `/access`
(`{access: AccessScope}`, **owner-only**). Only the `document` kind is registered on a
running server.

## Resource model carries `pinned` + `access` + `creatorId`

```ts
// systems/resources/types.ts
export type AccessScope = { projectWide: boolean; orgIds: string[]; userIds: string[] };
export type Resource = {
  id: string; name: string; kind: ResourceKind; updatedAt: number;
  pinned: boolean; access: AccessScope; creatorId?: string;
};
export const projectWideAccess = (): AccessScope => ({ projectWide: true, orgIds: [], userIds: [] });
```

The summary already returns `pinned`/`access`/`creatorId`, so `toResource` just maps them
(`access` defaulting to project-wide when omitted, since Omega drops an all-admitting
scope). `creatorId` is needed because access is owner-only — the dialog compares it to the
current user to decide whether the editor is writable.

## Pin + access write actions (documents real, mock kinds local)

```ts
// systems/resources/api.ts
export async function setResourcePinned(id: string, pinned: boolean): Promise<void> {
  const r = get(resources).find((x) => x.id === id);
  if (!r) return;
  if (r.kind !== 'document') { /* mock kinds: local only */ resources.update(...); return; }
  const updated = toResource(await api(`/resources/${r.kind}/${id}/attributes`,
    { method: 'PATCH', body: JSON.stringify({ pinned }) }));
  resources.update((list) => list.map((x) => (x.id === id ? updated : x)));
}
export async function setResourceAccess(id: string, access: AccessScope): Promise<void> {
  // …same shape; PATCH `/resources/:kind/:id/access` with body { access } …
}
```

Both mirror the existing `renameResource`/`removeResource` split: real PATCH for documents,
local-store update for the front-end mock kinds (slides etc.). Each refreshes the store from
the returned summary so pin/access stay in sync. Errors propagate to the dialog, which
toasts them (a non-owner `PATCH /access` is a 403).

## Settings dialog — real Access editor + real Pin

```svelte
<!-- ResourceSettingsDialog.svelte — documents only; owner-gated -->
Access:  ( Everyone in project | Restricted )
  Restricted → a checklist of project members (fetchMembers), preserving orgIds
  [ Save access ]   // disabled unless the scope changed; owner-only

Options:  <Switch bind:checked={pinned}
            onchange={(e) => togglePinned(e.currentTarget.checked)}
            label="Pin to top of the table" />
```

Visibility (a private/link mock that conflated project sharing) is replaced by a real
**Access** section for documents: a project-wide vs restricted toggle, and — when
restricted — a member allow-list loaded from the project roster (`fetchMembers`, the same
call the project-settings dialog uses). It is read-only for non-owners with an inline note,
and it round-trips `orgIds` so a later org edit isn't lost. The **Pin** switch is now real;
`togglePinned` calls the attribute route and reverts the bound state on failure. The mock
`MockBadge`s and local-only `visibility`/`pinned` state are gone.

## Table renders pinned first, with an indicator

```svelte
// ResourceTable.svelte — pinned always sort above the chosen order
if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
…
{#if r.pinned}<Pin class="size-3 -rotate-45 fill-current text-muted" aria-label="Pinned" />{/if}
```

Omega deliberately leaves ordering to the client (so keyset pagination stays correct), so
the table sorts pinned resources to the top within the user's chosen sort and marks them
with a small pin glyph.

## Companion backfill — the resources system

The `resources` system had **no** companions (like `projects`/`session` — a pre-existing
gap, unlike `ai-agent`/`documents`). Since this change works inside it, all five
`resources/*.ts` files got companions (single full-source fence, per Practice 1), not just
the two edited here, so the system is left companion-complete. `registry.test.ts` is a test
(exempt).

## Verification

- `pnpm check` — 0 errors, 0 warnings. `pnpm test` — 265 passed (+4 resource-attribute tests
  asserting the exact PATCH routes/bodies + the mock-kind local path).
- Contract matched to Omega source before wiring (summary-embedded read; PATCH-only writes;
  `{access}` body wrap; owner-only access).
- Companions byte-verified for all seven touched/added files.
- Live UI E2E pending (no headless Chrome). To try it on `:8443`: open a document's settings,
  flip **Pin** (it jumps to the top), set **Restricted** and pick members, **Save access**.
