# Project

The isolation boundary. Every piece of content in Icarus belongs to exactly one
project, and every query is scoped by it.

```ts
interface Project {
  name: string;
  description?: string;
  ownerId: Id<"users">;
  members: ProjectMember[];
  archivedAt?: number;
  updatedAt: number;
}

interface ProjectMember {
  userId: Id<"users">;
  role: "owner" | "editor" | "viewer";
  addedAt: number;
  addedBy: Id<"users">;
}
```

## Membership

Members are embedded rather than a join table. A project has a handful of them,
they are read on essentially every request to check access, and they change
rarely — which is the profile that embedding suits. A separate table would mean
a second read on the hot path to answer "may this person see this".

`ownerId` is separate from the `owner` role so the project always has exactly
one responsible account, even while roles are being edited. Transferring a
project changes `ownerId`; the outgoing owner stays a member unless removed.

Roles are coarse on purpose. `viewer` reads, `editor` writes content, `owner`
additionally manages membership and deletion. Per-resource permissions are not
modelled — if they become necessary they belong on the resource, not as a
proliferation of project-wide roles.

## Resources are found by index, not by a list

The project does **not** hold arrays of its document ids, file ids, or question
ids.

It is tempting, because it makes "everything in this project" a single read. But
every resource creation would then have to write the project document too,
which turns the project into a contention point that every mutation in the
system touches, and makes the 1 MiB limit a function of how much work has been
done in the project.

Instead each table indexes on `projectId` and is queried directly. The lookup is
as cheap and the project document stays small and rarely written.

## Archival

`archivedAt` hides a project without deleting it. Content is untouched and the
project can be restored. Deletion is a real delete — a soft-delete flag on every
object in the system is a per-query filter that gets forgotten exactly once
before it leaks someone's content.

## Related

[user](user.md) · [activity](../collaboration/activity.md)
