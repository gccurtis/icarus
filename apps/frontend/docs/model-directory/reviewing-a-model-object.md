# Reviewing a Model Object

The template exists so review is mechanical. Work down this list; each item is
answerable by opening one directory or reading one file. The structural items
are checked for you. The judgment items are the half worth your attention.

## Structure

1. `pnpm lint:model` passes. Every structural rule in this section is
   machine-checked; if lint is green, skip to the judgment items.
2. The object has `<object>.md`, a door, `types.ts`, a definition, and
   `constructor.ts`. All five are present.
3. The only directories at an object root are `methods`, `test`, and `docs`. An
   unused directory is absent, not empty.
4. Every complex method directory holds an entry file named for the directory.
5. Every path named in a method tree resolves on disk.
6. Imports from outside an object target its door. Nothing reaches past it to a
   definition, a method, or a private type.
7. Nothing is constructed at module scope anywhere under `model/`, only an
   environment door holds a mutable module-scope binding, and only a door reaches
   `$app/*`. A second holder is a second graph, and a leaf reading `browser` or
   `page` is taking its identity from ambient routing rather than from the
   argument its constructor was handed. Both accessors throw rather than
   returning `undefined`, and the client one guards on `browser` first — reaching
   a tab's graph from the server and reaching it too early are different
   mistakes, and one message cannot name both.
8. No `.svelte` file appears anywhere under `model/`. Components belong to the
   view layer.
9. The door matches the environment: `index.ts` on the client,
   `index.server.ts` on the server. The definition's extension follows its
   contents rather than its environment — a definition declaring `$state`,
   `$derived`, or `$effect` is `definition.svelte.ts` because runes do not
   compile in a plain `.ts`, and one declaring none is `definition.ts`. A client
   object may legitimately own no reactive state.
10. Every test file sits under its object's `test/`.
11. Environment roots are roots, not malformed objects: `client/index.ts`,
    `client/types.ts`, `server/index.server.ts`, `server/types.ts`,
    `server/scope.server.ts`, and `model.md` are exempt from the leaf template.

## The object

12. **Did this earn being an object at all?** An object owns something with a
    lifetime: state, identity, a subscription, a handle. Something that only
    reads and reshapes another object's state is a derived read, not an object,
    and it belongs to its source or to the view layer. Two objects were deleted
    for exactly this reason during the transition. This item exists so a third
    does not appear.
13. **Was shared state classified at the right lifetime?** State belonging to one
    mounted view is view-local. Model state survives a component being replaced,
    coordinates several views, or is deliberately persisted. State that does none
    of the three is in the wrong layer.
14. `<object>.md` distinguishes borrowed dependencies from owned ones. An object
    closes what it owns and never what it borrows. A graph where two objects both
    close one handle fails only during shutdown, and only sometimes.
15. Dependencies point one way. The object receives what it needs through its
    constructor and never reaches back to an object constructed after it.
16. The definition holds state and delegates. A definition carrying method bodies
    has absorbed `methods/`, and the execution flow is no longer readable from
    the directory.

## Methods

17. **Did the method earn a directory?** A directory announces an exposed
    boundary worth explaining. One holding an entry file and nothing else did not
    earn it; it is a file.
18. **Does a promoted `methods/shared/` procedure preserve an object-wide
    invariant?** Two methods wanting the same code is not enough. Promotion
    without an invariant moves code away from its owner and hides where the rule
    lives.
19. A complex method document explains the flow behind the surface rather than
    the surface again. The tree exists so a reader can find the file that does
    the work.
20. State read back from storage is validated before it re-enters the object.
    Stored state is input written by an earlier version of the application, and
    it is the one input an object accepts with no caller to blame.

## Lifetime

21. **Is construction atomic?** Anything acquired before a later step fails is
    released before the error escapes, and a half-constructed object never
    becomes reachable.
22. **Is closing idempotent and terminal?** A second call does nothing, and no
    call after it revives the object.
23. Closing attempts every owned cleanup even when an earlier one fails, and
    reports all failures. Replacing one failure with another loses the first, and
    the first is usually the cause.
24. A failure crossing the door is stated in the object's own vocabulary. A
    driver error reaching a consumer makes the dependency part of the contract.

## The surface

25. **Is returned state readonly to consumers?** Every mutation crosses a named
    method, so persistence, instrumentation, and invariants cannot be bypassed by
    a caller holding the array.
26. **No Svelte `Component` type appears in any model interface.** Objects expose
    stable keys — a resource kind, an activity id, an inspection kind — and the
    view layer resolves keys to components. Rule 8 catches the crude case; a type
    alias hides the subtle one from lint entirely.
27. `types.ts` exposes the object interface and public values only.
    Implementation state that escapes into a type becomes something a consumer
    can depend on.
28. The door exports the constructor and the public types, and nothing else. It
    is the whole of what the rest of the application is allowed to know.

## Documentation

29. `<object>.md` states ownership, lifetime, surface, and invariants. A document
    that restates its code has failed; a document that contradicts its code is
    worse than none.
30. `methods/methods.md` lists the public methods the definition actually
    delegates. A method listed but not delegated, or delegated but not listed, is
    the first sign the surface has drifted.
31. `docs/` holds only material belonging to no single file.

## Tests

32. `test/unit/` mirrors `methods/`, the constructor, and definition behaviour.
33. Each fixed defect has one file in `test/regression/`.
34. `test/non-functional/` covers concurrency, resource ownership, shutdown, and
    reactive propagation — the behavior the object's documents claim.
35. **Client object tests construct more than one instance.** A singleton leak is
    best detected by proving two instances stay independent: mutate one, and the
    other is unchanged.
36. **Server resource tests force each acquisition and cleanup step to fail in
    turn.** The assertion that matters is not only that an error is reported, but
    that every other owned resource was still released.
37. Tests exercise real behavior. A test that asserts its own fixture back is
    worse than no test, because it reports success either way.
