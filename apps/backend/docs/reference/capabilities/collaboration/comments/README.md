# Comments kind

## Status and authority

Comments is an implemented project-scoped capability for durable, flat,
plain-text annotations on project resources. It owns current comment state,
trusted attribution, soft deletion, exact command replay, target-scoped reads,
and a source-local Activity outbox.

An optional `subTarget` is an opaque JSON object owned by the target resource.
Comments validates and stores it, but never imports a resource kind to
interpret, update, or test it for freshness.

Startup constructs Comments with Activity, registers the command/query routes,
and retries pending Activity delivery before HTTP traffic is accepted.

## Documentation map

- [Concepts](concepts.md): ownership, targets, mentions, and lifecycle.
- [Types](types.md): public model, commands, queries, ports, and errors.
- [Runtime](runtime.md): construction, validation, persistence, and endpoints.
- [Flows](flows.md): command, query, replay, and Activity delivery sequences.
- [Invariants](invariants.md): admission, atomicity, lifecycle, and non-goals.

## Current source map

| Layer | Authority and entry points |
| --- | --- |
| Public exports | `index.ts` |
| Domain model/errors/validation | `domain/model.ts`, `domain/errors.ts`, `domain/validation.ts` |
| Canonical command digest | `domain/canonical.ts` |
| Application runtime | `application/commentService.ts` |
| Store and Activity ports | `ports/commentStore.ts`, `ports/activityPublisher.ts` |
| SQLite adapter/schema | `persistence/sqliteCommentStore.ts`, `persistence/sqliteSchema.ts` |
| Strict wire decoders | `wire/commandSchemas.ts`, `wire/querySchemas.ts` |
| Composition and routes | `create/comments.ts`, `registerCommentEndpoints.ts` |

The broader rationale is in
`scratch/comments-design.md`.
These files describe the implemented contract; runtime code takes precedence.

Focused coverage is in
`comments.test.ts` and
`comments-wiring.test.ts`.
