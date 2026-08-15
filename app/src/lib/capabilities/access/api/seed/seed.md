# API: `seed`

Creates the development user, project, and membership.

Registered as `api.capabilities.access.seed`. **Unscoped and unauthenticated** —
see [`overview.md`](../../overview.md) for why it has to be.

## Procedure Tree

```text
seed(ctx)
├── find the development user by subject          seed.ts
├── insert it when absent                         seed.ts
├── find a membership for its token               seed.ts
└── insert a project and a membership when absent seed.ts
```

## Idempotent by lookup, not by constraint

Every step reads before it writes, so running it twice changes nothing. That
matters because it is the natural thing to run after any schema push, and because
there is no unique constraint that would catch a second run.

## Why it exists at all

`resolveScope` refuses a token with no membership behind it. Without these rows
every call to every capability answers `no-such-project` and nothing renders. It
is scaffolding for exactly as long as there is no way to sign up.
