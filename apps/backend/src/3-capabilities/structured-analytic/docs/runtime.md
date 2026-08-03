# Structured Analytic runtime

## Layers, and what each owns

| Layer | Owns | Must not |
| --- | --- | --- |
| `domain/validation.ts` | Whether a definition is structurally coherent | Read data, or assume anything only the store knows |
| `domain/compile.ts` | Definition → Formula source | Evaluate |
| `persistence/` | Durable state, CAS, history | Interpret a definition |
| `application/` | Sequencing, and every decision that needs more than one port | Contain semantics — those are Formula's |
| `wire/` | Rejecting malformed requests | Re-validate a definition |

The `wire/` decoders pass the definition through untouched. `validation.ts`
already knows what a definition may contain and rejects with a `field` a client
can act on; a second copy of that rule would drift from the first.

## Endpoints

| Route | Queue | Why |
| --- | --- | --- |
| `POST /structured-analytics/command` | serial | Update and delete read-then-write across a CAS plus a history insert; `save`/`copy` check a name before writing under it. Neither is atomic in one statement. |
| `POST /structured-analytics/query` | concurrent | No writes, except the one revision-conditioned name repair a pull may make — idempotent, and it loses cleanly to a concurrent edit. |

`201` only for `analytic.created`; every other result is `200`.

## The store

Synchronous, because SQLite is and an analytic definition is a small local
record with no non-SQLite future to keep open. (Persona, Comments, Slides, and
Document went the other way so a networked store could drop in; a few kilobytes
of pills has no such future.)

Two tables per project: `sta_<prefix>_analytics` and the shared history table.
`definition_json` is **TEXT**, matching the history table's unavoidable
`JSON.stringify` encoding — Templates and Slides use BLOB with a Buffer encoder,
but one capability writing the same document two ways into two tables is worse
than matching either convention.

Three things about it are load-bearing and easy to get wrong:

**Transactions are IMMEDIATE.** A deferred transaction starts as a reader at the
guard `SELECT` and only becomes a writer at the `UPDATE`. In WAL mode, another
connection committing in between fails that upgrade with `SQLITE_BUSY_SNAPSHOT`,
which `busy_timeout` does not cover — so a lost CAS race would surface as a raw
error instead of the `false` the port promises.

**An id is retired until its history is purged.** History is keyed by
`(kind, id, revision)` and a new analytic starts at revision 1, so re-using an id
whose old snapshot survives collides on the *next* update — which then rolls back
forever, silently discarding every edit, while `latestSnapshot` reports the dead
analytic's final state as this one's. `insert` refuses instead.

**Purge checks liveness itself.** `purgeResourceHistory` never reads the current
table and cannot tell a live resource from a deleted one; it would happily
delete a live analytic's history and return `true`.

## Retention

`pruneHistory` and `purgeExpired` are bound into the process-wide sweep.

Prune is a **bounded window**, not an archive: an old snapshot goes whether or
not its analytic is live. Exactly one thing survives the cutoff — a deleted
analytic's terminal tombstone, so it stays discoverable as deleted and therefore
purgeable.

`purgeExpired` catches per-analytic failures and continues. The scheduler
swallows a throw from it, so an error that escaped would silently stop the sweep
for every analytic behind it, visible only in the counts.

## Logging

Everything is logged, labelled `{ detail: "content" }` so a production build can
drop it by configuration rather than by an audit of every call site.

The one deliberate exception is a pull's **rows**. They are derivable: a pull is
deterministic given the definition and the source revisions, and both are in the
record — so re-running it against those revisions reproduces them exactly.
Logging them would duplicate the response body into the log, and Formula permits
a million cells.

The contrast that makes the rule clear: `store.purged` logs the history it is
about to destroy, in full. That is not derivable from anything.
