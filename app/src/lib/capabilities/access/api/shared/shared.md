# Shared Access Procedures

Lives at `api/shared/shared.md`.

| File | Preserves |
| --- | --- |
| [`resolve-scope.ts`](resolve-scope.ts) | that a token is resolved only within the asking user's own memberships |

## `resolveScope`

Called by `projectQuery` and `projectMutation`, and by nothing else. Every scoped
call in the application passes through it exactly once.

It is the single most security-critical procedure in the deployment: it is the
only thing standing between a project token in a payload and that project's rows.
That is why it is the one procedure here with its own tests, and why one of them
holds a token belonging to somebody else.

Its refusal is deliberately uninformative — a token that resolves to nothing and
a token belonging to someone else answer identically, because distinguishing them
would confirm the project exists.
