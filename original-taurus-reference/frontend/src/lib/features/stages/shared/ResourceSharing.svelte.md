# `ResourceSharing.svelte`

The access editor for one resource: the Everyone/Restricted toggle, the member and organization
checkboxes, and Save.

It exists as its own component because **two surfaces need it** — the resource settings dialog and
the Overview inspector's Share modal. That is the arrangement `ProjectSharing` already has with the
project Share dialog and Project settings, and for the same reason: two copies of a permissions
editor is how they drift, and drift in a permissions editor is a security bug.

```ts
const isOwner = $derived(!resource.creatorId || resource.creatorId === currentUserId());
```

Omega allows only the resource's owner to change access (`SetAccess` → `ErrNotOwner`, 403 at the
edge). Non-owners get the editor read-only with one line saying why, rather than controls that
would fail on save. An unknown `creatorId` is treated optimistically — mock kinds save locally, and
a document would surface the backend's 403 as a toast.

State re-syncs from `resource` on change, so the component can be mounted once and pointed at
different resources. It loads members and organizations itself; the callers pass nothing but the
resource and its kind label.
