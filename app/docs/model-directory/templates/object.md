# {{Object Name}}

Lives at the object root as `{{object-name}}.md`. It is the entry point: a
reviewer reads this, then follows the file tree into the document that answers
their question. Keep the detail in those documents; keep the orientation here.

## Description

{{Object Name}} holds {{the state or resource that survives a method call}} so
that {{consumers can achieve a specific goal}}.

## Ownership Boundary

{{Object Name}} owns:

- {{state, resource, or identity it is authoritative for}}

Consumers own:

- {{what callers keep, decide, or hand in themselves}}

## Lifetime

- **Instance:** {{one per browser JavaScript realm / one per server process}}
- **Constructed by:** {{the environment root's composition function, named here}}
- **Released by:** {{the layout that initialized the model / process shutdown /
  nothing — this object holds nothing releasable}}

Singleton lifetime is a fact about the root, not about this directory. A cache
anywhere below the root is a second graph.

## Public Methods

Every method on `{{ObjectType}}`. **Shape** records the choice made when the
method was added: a file while one file tells the truth, a directory once it
owns supporting flow.

| Method | Shape | Effect | Description | Document |
| ------ | ----- | ------ | ----------- | -------- |
| `{{methodName}}` | {{file / directory}} | {{mutator / accessor}} | {{Behavior}} | [{{method-name}}.md](methods/{{method-name}}/{{method-name}}.md) |

A simple method has no document of its own. [`methods/methods.md`](methods/methods.md)
lists it.

## Exposed State

State a consumer can read off the instance.

| Field | Type | Meaning |
| ----- | ---- | ------- |
| `{{fieldName}}` | `readonly {{FieldType}}` | {{What a consumer learns from it}} |

Every field is readonly. Consumers read state and call methods; a writable field
hands this object's invariants to whoever holds a reference, and no method can
promise anything after that.

No field is a Svelte `Component` or a registry of them. This object exposes
stable keys and the view layer resolves them, so the model stays testable
without a DOM.

## Construction

```ts
export const {{constructorName}} = ({{dependencies}}): {{ObjectType}} => ...;
```

Every call returns a fresh object. State lives on the instance in the definition
module — no module-level value, no module-level counter or other mutable
identity, because every instance would then share it.

| Dependency | Ownership | Usage |
| ---------- | --------- | ----- |
| `{{dependencyName}}` | {{BORROWED / OWNED}} | {{What this object uses it for}} |

**BORROWED** means the caller constructed it and the caller releases it; this
object must never close it. **OWNED** means this object acquired it and must
release it. The wrong entry closes a resource another object is still using, or
leaks one nobody closes.

## Terminal Behaviour

State "None" when this object owns nothing releasable.

- **Terminal operation:** {{the method that ends this object's usable life}}
- **Releases, in this order:** {{owned resources, and why that order}}
- **After release:** {{what a later call does — rejects, no-ops, or cannot
  happen because the reference is gone}}

The layout that initialized the model runs this through `$effect` cleanup.
Nothing between the root and here decides when the object ends.

## Concurrency and SSR

- {{What overlapping calls do: serialized, last write wins, or rejected.}}
- {{Which methods are async, and what state a caller can observe mid-flight.}}
- {{For a client object: what it touches — browser storage, timers, `window` —
  that makes the root's browser guard load-bearing for this object.}}

## Invariants

Constraints that hold across every method. A method that cannot preserve one
fails instead of proceeding.

- {{Invariant every method must preserve.}}
- {{Ordering or identity invariant.}}
- {{Invariant tying exposed state to the resource behind it, when relevant.}}

## File Tree

Show only what this object has. Omit what it does not.

```text
{{object-name}}/
├── {{object-name}}.md
├── index.ts                        # index.server.ts on the server
├── types.ts
├── definition.svelte.ts            # definition.ts without runes, and on the server
├── constructor.ts
├── methods/                        # Omit only while the object does nothing
│   ├── methods.md
│   ├── {{simple-method}}.ts
│   ├── {{complex-method}}/
│   └── shared/                     # Omit until a second method needs one
├── docs/                           # Omit when no supporting doc exists
└── test/
```

The root holds what this object **is** — its document, its door, its types, its
state, and its constructor — and nothing else. A module that is neither state nor
a method still belongs in `methods/`: a codec, a wire format, a parser is the
execution behind the surface even when no consumer calls it by name, and
`methods.md` is where it says which caller it serves. The `layout` rule rejects
anything else at the root, because a file with no decided home is one nobody
decided the home of.

## Supporting Documents

Include only when `docs/` has entries.

| Document | Subject |
| -------- | ------- |
| [{{doc-name}}.md](docs/{{doc-name}}.md) | {{What it explains and why it belongs to no single directory}} |
