# ShareDialog.svelte

The top bar's **Share** modal. Real as of 2026-07-27 (workstream E).

## It used to be a mock, and it never needed to be

This file was 41 lines that copied a fixed string:

```svelte
const link = '/join/mock-share-token';   // changed no access; badged Mock
```

Meanwhile `ProjectSettingsDialog` — a few files away — managed access mode, minted role-carrying
links, and edited members against Omega, all real. Every capability Share needed was **already
shipped and already in use**, so this was a client-side gap, not a backend one; un-mocking it
required no backend work.

## What it is now

A thin frame around [`ProjectSharing`](../projects/ProjectSharing.svelte.md) — the same component
Project settings renders, so the two surfaces cannot drift:

```svelte
<Modal bind:open title="Share" size="md">
  <p>Control who can reach <span>{projectName}</span>. Anyone opening a link joins at that link's role.</p>
  <ProjectSharing {projectId} />
  <Button variant="ghost" onclick={() => (open = false)}>Done</Button>
</Modal>
```

The dialog owns only its framing sentence and the Done button. It gained a `projectId` prop — the
mock needed only a name — and `ShellTopBar` now passes both.

## What the user gets

Access mode, read/edit share links with copy / rotate / turn-off, and the member list with
invite-by-email. A minted link is a working `/join/:token` that grants its role.

`share-links.spec.ts` asserts exactly that: the dialog contains no `Mock` text, shows the real
access control, renders the token minted through the API, and a link created *through this dialog*
comes back from `GET /projects/:id/links` — which a mock could not do.
