# User

An account. Global, not project-scoped — one user belongs to many projects.

```ts
interface User {
  authSubject: string;         // stable id from the identity provider
  email: string;
  name: string;
  imageUrl?: string;
  lastSeenAt?: number;
  updatedAt: number;
}
```

## Identity

`authSubject` is the provider's stable subject claim, and it is the field to
look a user up by on sign-in. Email is not: people change their email address,
and matching on it means a changed address either silently creates a second
account or, worse, adopts an existing one.

`email` and `name` are stored anyway — they are needed to render a member list,
attribute a comment, or send a notification, and none of those should require a
round trip to the identity provider.

## What a user is not

The user document holds identity, not preferences and not state. Editor
settings, theme, and per-project UI state belong with the capability that owns
them, keyed by user. Putting them here makes a document that every request reads
into a document that every interaction writes.

`lastSeenAt` is the one exception, and it exists only to answer "is this person
active" in a member list. Live presence — who is looking at what right now — is
not persisted state at all.

## Membership

A user does not list their projects. [Project](project.md) holds its members,
and "projects for this user" is an index over that. Storing it on both sides
means two writes per membership change and a class of bug where they disagree.

## Related

[project](project.md)
