# Endpoint registry

This describes [`registry.ts`](registry.ts), which it sits beside. For the
directory it belongs to, see [`runtime.md`](runtime.md).

The registry is the runtime-scoped table mapping an endpoint identity to the
endpoint job that answers it. There is one per backend process, filled during
startup and never written to after the server listens.

## Why one file

It was a directory of two, `registry.ts` and `registry-constructor.ts`, which
gave the spine a directory whose whole content was a fifty-line class and the
function that constructs it. The capability template splits definition from
construction for a reason — `constructor.ts` is the only place a capability
performs startup work, and that rule needs a file to name. The registry performs
no startup work at all: `createRegistry()` returns an empty table. There was
nothing for the split to protect.

## Endpoint identity

An endpoint is a method and a path, and its key is the two joined by a space —
`GET /health`. Matching is exact string equality. There are no path parameters,
no wildcards, and no precedence order to reason about, because nothing served
today needs one. A capability wanting `/documents/:id` would be asking for a
matching strategy this table does not have, and the honest answer is to add it
here rather than to encode identity into a path string that only looks dynamic.

Exact means exact on the method too, including `HEAD`. The convention that a
`HEAD` is answered by the endpoint's `GET` job lives in
[the transport](../capabilities/platform/web-server/runtime-api/register-transport/register-transport.md),
which retries the lookup, because that convention is HTTP's and this table is not
a model of HTTP.

Registering a key twice throws. A duplicate endpoint is always a wiring mistake
made once at startup, never a request that could fail in production, so it fails
the process rather than being resolved by some last-writer-wins rule.

## The registry registers nothing itself

`createRegistry()` returns an empty table, and `registry.ts` imports no
capability. Every endpoint is registered from
[`build-runtime.ts`](build-runtime.ts), in one list, by calling the
`register<Capability>Endpoints` that each capability exports from its own
`index.ts`.

Built-in was registered here until the registry stopped importing capabilities.
Keeping the spine free of capability names is what makes `build-runtime.ts` the
only file that knows which capabilities exist.

`createRegistry()` survives as a named constructor even though its body is one
expression, for the reason
[`createIdFactory()`](../capabilities/platform/id-factory/runtime-objects/id-factory/id-factory.md)
gives: exporting a constructor rather than an instance lets a runtime own its
table's lifetime.

## What the registry does not do

It does not execute. `find` returns a job and the caller invokes it — today
[the web server's transport](../capabilities/platform/web-server/runtime-api/register-transport/register-transport.md),
which normalizes a Fastify request into a `RequestEnvelope`, looks the endpoint
up, and calls the job directly.

It also does not queue, bound concurrency, defer a response, or reject on
capacity. The job system that did those things is in
[`reference/workflows/`](../../../../reference/README.md) and is not wired;
nothing the spine serves needs it. It comes back with the first capability that
does, or is replaced by a durable workflow engine.

`list()` exists for the `backend.started` record, so a booted process states the
surface it is serving in the log. It used to fill the 404 body as well, on the
argument that an unmatched request should answer with the surface that does
exist; that stopped, because advertising every registered endpoint to an
unauthenticated caller is a poor trade for a convenience the startup log already
provides.

## Invariants

- One registry per backend runtime, filled before the server listens and not
  written to afterward.
- An endpoint key identifies at most one job. A second registration of the same
  key throws at startup.
- The registry holds no Fastify type and imports no capability. It knows
  `RequestEndpoint` and `RequestEnvelope` from the web server, and nothing about
  what any job does.
- A job chooses its own status code. Nothing here maps outcomes onto statuses.
- `list()` is sorted, so the startup record is stable between runs.
