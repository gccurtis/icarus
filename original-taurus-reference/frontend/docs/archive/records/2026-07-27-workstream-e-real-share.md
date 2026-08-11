# 2026-07-27 — Workstream E: the Share dialog is real

The top bar's Share modal was a **41-line mock** that copied a fixed `/join/mock-share-token` and
changed no access. It is now real — and required **no backend work at all**.

## The finding

Asked "is the real Share model ours or Omega's", the answer was neither: it was already built.
`ProjectSettingsDialog`, a few files away, managed access mode, minted role-carrying links, and
edited members against Omega — `fetchLinks` / `rotateLink` / `disableLink`,
`updateProject({visibility})`, `fetchMembers` / `addMember` / `setMemberRole` / `removeMember` —
with `joinByToken` already covered by a passing `/join/:token` e2e.

Two surfaces for one concept, one of them lying. That made it a workstream, not a backend request.

## The change

`features/projects/ProjectSharing.svelte` (new) holds access + links + members. **Both** dialogs
render it, so they cannot drift:

```svelte
<!-- ProjectSettingsDialog and ShareDialog, identically -->
<ProjectSharing {projectId} />
```

- `ShareDialog` 41 → 30 lines: a framing sentence, the component, Done. Gained a `projectId` prop
  (the mock needed only a name).
- `ProjectSettingsDialog` lost ~200 lines and nine handlers, keeping only what is unique to
  settings — name, icon, danger zone.

**Lazy by construction:** `Modal` renders children behind `{#if open}`, so mounting `ProjectSharing`
*is* the lazy load. The settings dialog's `open &&` guard around its member/link fetches went with
them; its remaining effect only reseeds the editable name.

## Two details worth keeping

`loadLinks` swallows its error deliberately — the route is owner-only, and a non-owner should see no
link controls rather than an error they cannot act on.

Every write re-checks `projectId === id` before committing, so switching projects mid-flight cannot
land the previous project's members in the list. That guard came across from the original.

## Verification

A new `share-links.spec.ts` case proves it is not a mock: no `Mock` text, the real access control
present, the token minted through the API rendered in the dialog, and — the part a mock could not
fake — a link created **through the dialog** coming back from `GET /projects/:id/links`.

`persona-and-surfaces.spec.ts` asserted the opposite (that Share *was* a badged mock) and failed
correctly; it now asserts the absence of the badge and defers the deeper checks to `share-links`.

`pnpm check` 0 errors / 0 warnings · 338 unit tests · `pnpm build` clean · companions fresh ·
**full e2e 13/13 across four consecutive runs**, plus `document-inspector` 25/25 on
`--repeat-each=5`. One inspector failure occurred on the first run immediately after the component
change and did not reproduce in any of the following runs; recorded rather than explained away.
