# Project

The isolation boundary. Every piece of content in Icarus belongs to exactly one
project, and every query is scoped by it.

```ts
interface Project {
  name: string;
  description?: string;
  archivedAt?: number;
  revision: number;
  updatedAt: number;
}

interface Membership {
  userId: Id<"users">;
  projectId: Id<"projects">;
  /** The opaque handle this user carries in its URL for this project. */
  token: string;
  role: "owner" | "editor" | "viewer";
}
```

## Membership is a table, and the token is why

An earlier draft embedded members on the project, reasoning that a handful of
them are read on every request and a separate table means a second read.

That is wrong, and not by a little. **Each membership carries its own token** —
the handle that user puts in their URL for that project — and resolving one means
looking up `(userId, token)`. An index leading with `userId` is what makes a
copied URL land in someone else's key range and find nothing.

You cannot index into an embedded array. Embedding would mean scanning every
project in the deployment to resolve one token, so the design that looked like it
avoided a read actually makes the only read impossible.

**The lookup is the authorization.** A membership row exists, or the caller is
not in the project; there is no second check to forget. That is also why the
member list is not a hot-path cost the way the embedded version assumed — the
membership read is the *only* read, not an extra one.

A token is safe in a URL and useless to pass on, because it is scoped to one
person and one project.

## There is no `ownerId`

Ownership is the membership whose `role` is `owner`. A copy of it on the project
would be a second answer to the same question, free to disagree with the first
after any membership edit.

The invariant — at least one owner membership per project — is enforced when a
membership is removed or demoted, which is the only moment it can be violated.

Roles are coarse on purpose. `viewer` reads, `editor` writes content, `owner`
additionally manages membership and deletion. Per-resource permissions are not
modelled; if they become necessary they belong on the resource, not as a
proliferation of project-wide roles.

## Resources are found by index, not by a list

The project does **not** hold arrays of its document ids, file ids, or question
ids.

It is tempting, because it makes "everything in this project" a single read. But
every resource creation would then have to write the project document too, which
turns the project into a contention point that every mutation touches, and makes
the 1 MiB limit a function of how much work has been done.

Instead each table indexes on `projectId` and is queried directly. The lookup is
as cheap and the project row stays small and rarely written.

## `revision`

Bumped on every accepted write. A client sends the revision it read, and a write
against a stale one is rejected.

This is not the problem Convex's transactions solve — those prevent two writes
racing inside a mutation. This is someone who opened the project settings, went
to lunch, and saved over an edit made while they were out. The read happened in a
query minutes ago, so no transaction covers it. See
[conventions](../README.md#revision-on-directly-edited-objects).

## Archival

`archivedAt` hides a project without deleting it. Content is untouched and the
project can be restored. Deletion is a real delete — a soft-delete flag on every
object in the system is a per-query filter that gets forgotten exactly once
before it leaks someone's content.

## Related

[user](user.md) · [actor](actor.md) · [activity](../collaboration/activity.md)
