# Persona

Named behaviour definitions layered onto agentic tasks. A persona answers five
questions a task needs answered before it starts: what to concentrate on, what to
already know, how to work, what to produce, and when to stop. It may also carry one
reference to reusable source material.

Persona is deliberately **not** an agent. It holds no task state, makes no model call,
chooses no model, executes no tool, and resolves no scope. It produces one
deterministic block of text plus one optional resource reference, and hands both to a
consumer that freezes them into its own task.

The project catalog is current-only. Superseded revisions and terminal deletions live in
a separate history table; logical deletion also deletes Persona's owned private Context
wrapper, while purge removes both retained histories.

## Status and authority

**Implemented and tested** across
[`persona.test.ts`](../../../../test/capabilities/persona.test.ts) and
[`persona-wiring.test.ts`](../../../../test/capabilities/persona-wiring.test.ts).

There is **no consumer yet**. Derived Outputs is unchanged, and Agents does not exist.
`resolve()` is exercised only by tests. The snapshot shape is the contract Agents will
be built against.

`docs/capabilities-old/persona.md`, if present, describes a Library-kernel design with a
library/local split and a version table. **That was not built and must not be read as
describing current behaviour.** The freeze model replaces what those mechanisms existed
to provide: work in flight cannot be changed by a later edit, because the consumer holds
its own copy of the rendered prompt.

`scratch/persona-design.md` is the design record and has been reconciled with what is
built here.

### Deliberate deviations, so they are not rediscovered as bugs

- **No command-receipts table.** Comments carries one because its commands are
  externally retried. Persona uses expected revisions for update/delete and does not
  promise replay of a completed response; `create` is also not replayed. Add receipts if
  a real need appears.
- **Limits live in [`domain/validation.ts`](../domain/validation.ts)** as
  `DEFAULT_PERSONA_LIMITS`, not in `etc/configuration.yaml`, matching Comments. Adding a
  `persona:` config section later is a ~3-line change in `loadBackendConfig.ts` plus an
  override passed through `initialization/runtimes/persona.ts`.
- **No Activity publication.** Doing it correctly needs an outbox row written in the
  same transaction as the mutation, which is more machinery than a catalog capability
  warrants right now.
- **No project default pointer.** A mutable global pointer would silently change the
  behaviour of every future task — the action-at-a-distance the freeze model exists to
  prevent, reintroduced one layer up. A consumer wanting a default stores a persona id
  in its own configuration.

## Implementation map

| Concern | File |
| --- | --- |
| Canonical types, commands, queries | [`domain/model.ts`](../domain/model.ts) |
| Typed errors | [`domain/errors.ts`](../domain/errors.ts) |
| Definition and prompt digests | [`domain/canonical.ts`](../domain/canonical.ts) |
| Deterministic rendering | [`domain/render.ts`](../domain/render.ts) |
| Ingress validation and limits | [`domain/validation.ts`](../domain/validation.ts) |
| The built-in fallback | [`domain/builtin.ts`](../domain/builtin.ts) |
| Runtime, wrapper lifecycle, freeze | [`application/personaService.ts`](../application/personaService.ts) |
| Store contract | [`ports/personaStore.ts`](../ports/personaStore.ts) |
| The narrow Context slice | [`ports/personaContext.ts`](../ports/personaContext.ts) |
| Table names, DDL, pragmas | [`persistence/sqliteSchema.ts`](../persistence/sqliteSchema.ts) |
| SQLite adapter | [`persistence/sqlitePersonaStore.ts`](../persistence/sqlitePersonaStore.ts) |
| Wire decoders | [`wire/`](../wire/) |
| Endpoints and error mapping | [`registerPersonaEndpoints.ts`](../../../api/routes/persona/registerPersonaEndpoints.ts) |
| Composition | [`create/persona.ts`](../../../initialization/runtimes/persona.ts) |

## Reading order

| Page | Covers |
| --- | --- |
| [concepts.md](concepts.md) | Sections, the private wrapper, freeze, the built-in |
| [types.md](types.md) | Definition, record, snapshot, errors, persistence |
| [runtime.md](runtime.md) | Method-by-method behaviour and logging |
| [flows.md](flows.md) | Endpoints, call chains, the consumer contract |
| [invariants.md](invariants.md) | Guarantees, non-guarantees, limits |
