# Frontend Directory Types

**Status:** Working architecture map. The capability directory is already a
standard. The model and view directories are being designed and are not yet
enforced.

This document answers one question: when a new piece of code arrives, which
kind of directory owns it?

A directory type is warranted when the same ownership boundary will appear
repeatedly and reviewers need a path to carry meaning. It is not warranted for
every folder. SvelteKit routes, the application shell, generated primitives,
and the design system already have organizing forces of their own.

## The three authored leaf types

| Type | Location | Owns | Defining test |
| --- | --- | --- | --- |
| Capability | `src/lib/capabilities/**` | Canonical database-backed data and the functions that operate on it | Does it own rows and remain procedural between calls? |
| Model object | `src/lib/model/{client,server}/**` | State or a resource with a real lifetime | Is there identity or state that must survive more than one call and eventually be replaced or released? |
| View | `src/lib/views/**` | A rendered surface and the interaction/effect tree that makes it usable | Does it present model or capability state to a person? |

The detailed standards are:

- [The Capability Directory](capability-directory/capability-directory.md)
- [The Model Directory](model-directory/model-directory.md)
- [The View Directory](view-directory/view-directory.md)

## Dependency direction

```text
routes and shell
       |
       v
     views  -----------------------> capability browser doors
       |                                      |
       v                                      v
model/client objects                 capability procedures
                                              |
                                              v
                                     model/server doors
```

The arrows are import permissions, not merely runtime calls.

- Routes and the shell compose views and construct the client model.
- Views consume client model objects and capability browser doors.
- Client model objects may consume capability browser doors when synchronization
  belongs to the object's lifetime rather than to one rendered interaction.
- Capability procedures consume server model doors.
- Server model objects consume other server model doors through construction,
  never through a view or a route.
- Neither client nor server model objects import Svelte components from views.
- Capabilities never import client model objects.

The view layer is therefore downstream of both forms of model. A registry that
maps an inspection kind to a Svelte component is a view concern even when a
client model object owns the currently selected inspection kind.

## Composition roots are not leaf types

Some directories assemble objects without being objects themselves:

- `model/client/` constructs the per-render client model and places it in Svelte
  context.
- `model/server/` constructs the process model and owns request scope resolution.
- `shell/` composes permanent application zones.
- `routes/` lets SvelteKit compose URLs, layouts, loads, actions, and HTTP-only
  operational endpoints.

These roots need explicit, narrowly named exceptions in structure lint. They do
not need generators or a fake leaf shape.

## Directories that keep their own conventions

| Directory | Convention |
| --- | --- |
| `simple-components/` | Generated or vendor-derived primitive component families. Preserve their upstream organization and local imports. |
| `style/` | The design-system documents and token layers are its standard. |
| `demo/` | A development reference surface, organized for demonstration rather than application ownership. |
| `hooks/` | Small framework helpers. A helper that gains durable state or a significant public contract is reclassified instead of growing here indefinitely. |

## Promotion tests

When ownership is unclear, use these tests in order.

1. If it owns canonical database-backed state, it is a capability.
2. If it owns state, identity, a subscription, a handle, or another lifetime, it
   is a model object.
3. If it renders or coordinates a rendered interaction, it is a view concern.
4. If it only assembles other owners, it belongs to a composition root.
5. If it is pure and private, it belongs beneath the owner that uses it. It does
   not earn a top-level directory.
6. If a second owner needs the same pure behavior, first ask which invariant it
   preserves. Promote it only when that invariant has a real shared owner.

## Tooling direction

Each authored leaf type will eventually have the same three artifacts:

```text
docs/<type>-directory/        written contract, review checklist, templates
scripts/generation/<type>/    scaffolds that already satisfy structural lint
scripts/lint/<type>/          rules tested against isolated broken fixtures
```

One top-level `pnpm lint` should aggregate all structural and path checks. Shared
helpers may parse imports, names, documents, and aliases, but each directory
type keeps its own rules. A single generic schema would hide the important
differences: a capability is procedural, a model object has lifetime, and a
view has a component tree.
