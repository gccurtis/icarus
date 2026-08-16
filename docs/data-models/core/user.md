# User

An account. Global, not project-scoped — one user belongs to many projects.

```ts
interface User {
  authSubject: string;         // stable id from the identity provider
  displayName: string;
  email?: string;
  imageUrl?: string;
  lastSeenAt?: number;
  updatedAt: number;
}
```

## Identity

`authSubject` is the provider's stable subject claim, and it is the field to look
a user up by on sign-in. Email is not: people change their email address, and
matching on it means a changed address either silently creates a second account
or, worse, adopts an existing one.

`email` and `displayName` are stored anyway — they are needed to render a member
list, attribute a comment, or send a notification, and none of those should
require a round trip to the identity provider.

`email` is optional, and only because authentication does not exist yet: the
development seed has no email to supply. It becomes required when auth lands.

## `displayName`, not `name`

A user's identity is `authSubject`. `displayName` is a human label over it, and
naming it that way says so.

The rule holds across the models: **`name` where the name is the identity** — a
[project](project.md), a [persona](../ai/persona.md), an
[automation](../ai/automation.md), a
[resource set](../special-resources/resource-set.md) — and **`displayName` where
it is a label over a machine identity**. A
[connector](../special-resources/connector.md) is the other case: its identity is
a provider plus a credential, and its `displayName` is what a person calls it.

## What a user is not

The user document holds identity, not preferences and not state. Editor
settings, theme, and per-project UI state belong with the capability that owns
them, keyed by user. Putting them here makes a document that every request reads
into a document that every interaction writes.

`lastSeenAt` is the one exception, and it exists only to answer "is this person
active" in a member list. Live presence — who is looking at what right now — is
not persisted state at all.

## Membership

A user does not list their projects. Membership is [its own
table](project.md#membership-is-a-table-and-the-token-is-why), indexed by user,
and "projects for this user" is a query over it. Storing it on the user as well
would mean two writes per membership change and a class of bug where they
disagree.

## Related

[project](project.md) · [actor](actor.md)
