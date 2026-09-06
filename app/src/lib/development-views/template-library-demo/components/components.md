# Template Library Demo components

Lives at `src/lib/development-views/template-library-demo/components/components.md`.

<!-- generated:inventory:start -->

- `behavior-map.svelte`
- `branch-audit.svelte`
- `data-flow.svelte`
- `library-stage.svelte`

<!-- generated:inventory:end -->

## `library-stage.svelte`

Builds an isolated Workspace State from the scoped Client Model's project and
editor-runtime registers, with explicit zero persistence thresholds. It
activates the Templates singleton and provides that coordinator to the real
Context, Content and Inspector surfaces. It owns only the development frame
around them. It imports no Template procedure and supplies no replacement data.

## `behavior-map.svelte`

The seven library gestures and their system-visible result. Static explanatory
content; it has no product interaction state. The Find and Duplicate entries
state the current owner-only visibility fallback rather than presenting the
future Project vocabulary as working access control. Shared is deliberately not
part of the current library contract.

## `data-flow.svelte`

Two flows: the implemented path from seed to three product panes, and a clearly
marked, deferred proposal that would take a Template body through a durable
authoring session and temporary editor identity. The arrows describe ownership
boundaries rather than runtime progress. The proposal requires explicit
Done/Cancel, flush-before-commit, compare-and-swap and expiry semantics; it does
not couple generic tab close to deletion.

## `branch-audit.svelte`

A filterable, exact review index parsed from the checked-in
`components/branch-audit.diff`. Every changed path is rendered in full with its addition
and deletion counts, an exact-file change explanation, its area's justification,
and a disclosure containing the exact unified diff. The snapshot excludes only
its own generated diff file to avoid recursion. It performs no Git or network
request at runtime.
