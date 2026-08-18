# Configuration

Lives at the object root as `configuration.md`. It is the entry point: a
reviewer reads this, then follows the file tree into the document that answers
their question.

## Description

Configuration holds the settings the **server** published to this browser tab, so
that any client object needing a tuned value reads it from one place instead of
carrying a constant that silently disagrees with `configuration/`.

It exists because the YAML is read by
[`$model/server/configuration`](../../server/configuration/configuration.md) and
the `environment` rule forbids the client tree from importing it. Without this
object, a client-side threshold has to be a literal — and a literal beside a YAML
file holding the same number is two sources of truth with nothing keeping them in
step.

## Ownership Boundary

Configuration owns:

- The published snapshot for this client instance, for its whole life
- How a dotted key path resolves against it
- The refusal when a key that must be present is not

Consumers own:

- Which keys they read, and what shape each value must be
- Whether a key may be absent — this object never defaults, coerces, or asserts
- Every value's meaning. This holds numbers; it does not know one is milliseconds

## Lifetime

- **Instance:** one per client instance
- **Constructed by:** `buildClientModel`, in `constructor.ts`
- **Released by:** nothing — this object holds nothing releasable

The snapshot arrives with the layout's load data. Switching projects is a full
page load, so there is no case where a live instance should see different values
than it started with, and no reload path to build.

## Public Methods

| Method | Shape | Effect | Description | Document |
| ------ | ----- | ------ | ----------- | -------- |
| `get` | file | accessor | Resolves a dot-separated key path, or `undefined` | [`methods/methods.md`](methods/methods.md) |

`requiredNumber` is exported beside the interface rather than being a method on
it. It is a rule about a *consumer's* expectations, and putting it on the object
would be the first step toward this holding everyone's expectations at once —
which is exactly what the one-method surface is protecting against.

## Exposed State

None. Everything is read through `get`.

A `snapshot` getter was considered and rejected: handing out the mapping means a
consumer can walk it, and the moment one does, the published key list stops being
the contract.

## Construction

```ts
export const createConfiguration = (snapshot: ConfigurationSnapshot): ConfigurationModel => ...;
```

Every call returns a fresh object. The snapshot is a parameter rather than
something this fetches, which is what makes every read synchronous — an object
that awaited its own values would make `buildClientModel` async and force every
consumer of a key to cope with not having one yet.

| Dependency | Ownership | Usage |
| ---------- | --------- | ----- |
| `snapshot` | BORROWED | Held for the instance's life; never mutated, never handed on |

Nothing is frozen. The server twin freezes because its snapshot is shared by
every request in the process; this one belongs to a single browser tab and is
handed to nobody, so a freeze would guard against sharing that does not exist.

## Terminal Behaviour

None. This object owns nothing releasable — no timer, no subscription, no
handle. It is a frozen-in-practice value with one reader.

## Concurrency and SSR

- Every method is synchronous and pure, so overlapping calls cannot interleave
  into anything one call would not produce.
- Nothing is async. There is no state a caller can observe mid-flight.
- This object touches no browser API at all — no storage, no timer, no `window`.
  It is the one client object that would work unchanged on the server, and it
  lives here because *what it holds* is per-tab, not because of what it uses.

## Invariants

- **The snapshot is never mutated.** It is held in a private readonly field and
  no method writes; a consumer that could change it would change what every later
  reader sees.
- **A key that resolves to nothing is `undefined`, never a default.** The
  consumer decides whether that is an error.
- **Key resolution matches the server's exactly.** The two traversals are
  deliberate copies; a divergence would make one key mean two things.
- **Nothing unpublished is reachable.** This holds only what
  `+layout.server.ts` put in the snapshot, so a key that was never published is
  indistinguishable from one that does not exist.

## File Tree

```text
configuration/
├── configuration.md
├── index.ts
├── types.ts
├── definition.ts
├── constructor.ts
├── methods/
│   ├── methods.md
│   └── get.ts
└── test/
```

## What publishes into it

[`src/routes/app/[project]/+layout.server.ts`](../../../../routes/app/%5Bproject%5D/+layout.server.ts)
holds the list of keys the browser may see, and projects them out of the server's
configuration into the snapshot.

**An allowlist, never the whole tree.** The merged YAML also carries the
development project token and the observability settings, and a page's load data
is serialized into the document where anyone can read it. Publishing by omission
is how a secret ships.
