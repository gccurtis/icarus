# Access

Who exists, what projects exist, and who may reach which. The capability every
other capability's scope is resolved against.

## Public Surface

| Function | Kind | Answers |
| --- | --- | --- |
| `seed` | mutation | creates the development user, project, and membership; idempotent |

`resolveScope` is not public. It is a shared procedure called by `projectQuery`
and `projectMutation` in [`$convex/functions`](../../../convex/functions.ts), and
it is the only thing that turns a token into a `Scope`.

## It registers unscoped, and it has to

**This is the one capability whose registrations do not use `projectQuery` or
`projectMutation`**, and the exception is structural rather than a shortcut: the
gate resolves a project token against a membership, and `seed` is what creates
the first membership there is. A scoped `seed` could not run until it had already
run.

Any other capability registering unscoped is a defect. This is what the rule
means by "unless its document says why not".

## Two things are missing, and they are not the same kind of missing

**Identity is stubbed.** `resolveScope` resolves a fixed development subject
rather than reading `ctx.auth`, so every caller is treated as the same user.
Nothing is kept out. Replacing two lines with `ctx.auth.getUserIdentity()` is the
whole of fixing it, and every handler in the application is already written
against the shape that fix produces.

**`seed` is world-writable.** It takes no arguments and anyone can call it. That
is survivable only because it is idempotent and creates exactly one fixed user
and project. It goes when signing up exists.

## Data Ownership

| Stored | Purpose |
| ------ | ------- |
| `users` | one row per person, keyed by `authSubject` and carrying the label and contact a member list renders from |
| `projects` | one row per project: its name, description, archival mark, and revision |
| `memberships` | one row per (user, project), holding that user's own token for it and their role |

These are the only tables in the application not scoped to a project, because
they are what decides what a project scope *is*.

`users.email` is optional, and only until authentication exists — `seed` has no
email to supply. It becomes required when auth lands.

## Capability Invariants

- **The lookup is the authorization.** A token is only ever resolved within one
  user's own memberships, so there is no separate membership check to forget. A
  token that is not in the asking user's rows resolves to no project at all.
- **`memberships.by_user_and_token` leads with `userId`.** A token-first index
  would resolve any token to its project regardless of who presented it. With the
  user first, a copied URL lands in someone else's key range and finds nothing.
- **A refusal never distinguishes "no such project" from "not yours."** Telling an
  unauthorized caller that a project exists is itself a disclosure.
- **Each collaborator holds their own token for a project.** That is what makes a
  token safe in a URL and useless to pass on.
- **A user is looked up by `authSubject`, never by email.** People change their
  address, and matching on it either creates a second account silently or adopts
  someone else's.
- **Ownership is a membership `role`, not a column on the project.** A stored
  copy is a second answer free to disagree with the first. "At least one owner"
  is enforced wherever a membership is removed or demoted, which is the only
  moment it can break — and nothing here can do that yet.
