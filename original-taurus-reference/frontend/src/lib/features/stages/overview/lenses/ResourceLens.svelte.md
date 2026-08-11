# `ResourceLens.svelte`

The lens for one inspected resource — reached by clicking a row in the Overview resources table.
What it is, who owns it, and what has been happening to it.

## Reading the live row

```ts
const resource = $derived($resources.find((r) => r.id === resourceId) ?? null);
```

The selection carries an id, not a snapshot, so this re-derives from the catalog. A rename or a pin
made elsewhere is reflected while the lens is open, and a resource deleted underneath the selection
falls to "This resource is no longer available" rather than showing facts that are no longer true.

## Updated, then Sharing

**Created** was dropped: it sat directly above Updated and was almost never the interesting one, and
two timestamps competing for the same glance is noise. The one-line *Access* summary went too —
replaced by the Sharing section below, which says the same thing better and can act on it. That
retired `accessSummary` from `lens-helpers.ts`, which nothing else used.

## Sharing

Owner, then the control, then who has access — deliberately the same shape as the library's asset
details, so the two read as one idea rather than two conventions.

```ts
const canShare = $derived(
  !!resource && resource.kind === 'document' &&
    (!resource.creatorId || resource.creatorId === currentUserId())
);
```

The **Share button only appears when the user can actually share.** Omega permits only the resource's
owner to change access, so for anyone else the button would be a control that fails; they still get
the owner and the reach as facts. Access is a real backend concept for documents only, which is the
other half of the condition.

The editor behind it is [`ResourceSharing`](../../shared/ResourceSharing.svelte.md) — the same
component the resource settings dialog renders, so the two cannot drift.

The owner row carries no icon tile, unlike the library's: `IdentityHoverCard` brings its own avatar,
and two faces on one row is one too many.

Member and organization names are looked up **only for a restricted resource** — a project-wide one
describes itself as "Everyone in the project" and needs no roster. Unresolved ids degrade to
"Unknown member" rather than rendering a raw id.

## Recent activity

```ts
void loadActivityPage(projectId, null, RESOURCE_EVENT_CAP, id)
```

The fourth argument is Omega's `targetID` filter, used here rather than document history because it
works for **every** resource kind — change-level history exists only for documents, and a lens rich
for one kind and empty for the rest reads as broken rather than as an honest limit.

Capped at `RESOURCE_EVENT_CAP` (25) and rendered through
[`ActivityList`](ActivityList.svelte.md), which is height-capped and scrollable: a document edited
all afternoon would otherwise push the panel to arbitrary length. When the cap is reached the
heading says `latest 25`, so a truncated list never passes for a complete one.

`documentId` is passed only for documents, which makes each row expandable to reveal what that edit
changed. That is the gesture the list invites — you read "edited" and want to know what the edit
was — answered in place rather than by navigating away.

The `generation` counter guards against a late response from a previously selected resource
overwriting the current one, the same pattern `ActivityFeed` uses for project switches.
