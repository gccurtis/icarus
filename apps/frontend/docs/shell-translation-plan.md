# Shell View Translation Plan

**Status:** Implementation plan, not started.
**Standard:** [The View Directory](view-directory/view-directory.md)
**Templates:** [View document templates](view-directory/templates/templates.md)

`src/lib/demo/` has already moved to `src/lib/views/demo/`. This plan covers the
remaining surface.

| Current owner | Target view | Route entry |
| --- | --- | --- |
| `src/lib/shell/` and the rendered frame in `routes/app/[project]/+layout.svelte` | `src/lib/views/shell/` | `/app/[project]` |

The move is complete when the route owns only SvelteKit concerns, the view
exposes one root component, and `src/lib/shell/` no longer exists.

## Decisions

- Keep the name `shell`.
- Route files own parameters, model initialization, SSR policy, load data, and
  route content. They do not compose a view's private component tree.
- `shell.svelte` is the only component its route imports.
- Shell panel geometry remains client-model state. It does not become view
  `shared/` state because the shell renders it.
- Preserve `/app/[project]` with `ssr = false`.

## Target

```text
src/lib/views/shell/
├── shell.md
├── shell.svelte
└── components/
    ├── components.md
    ├── topbar.svelte
    ├── tabstrip.svelte
    ├── inspector.svelte
    ├── status.svelte
    └── context-panel/
        ├── context-panel.svelte
        └── components/
            ├── rail.svelte
            └── content.svelte
```

Move the rendered frame, geometry, overflow rules, and client-model read from
`routes/app/[project]/+layout.svelte` into `shell.svelte`. Its public contract is
one required `children` snippet for the route-owned work surface.

The five permanent zones are direct children. `context-panel` is a complex
component because it owns the rail/content subtree.

The zones stay components in this move. The shell reads the client model and
passes what each zone renders, so none yet meets the promotion test in the
standard: reading the model itself, owning coordinating state, or needing
extracted behavior. Several are expected to become views once they carry real
content — the tab bar, context panel, inspector, and workspace each plausibly
will. Promote them then, as siblings under `views/`.

## Client-model gate

The move begins after `$model/client` exposes the production initializer and
accessor described by the model-directory standard. The route layout must:

1. retain `export const ssr = false` in `+layout.ts`;
2. derive the project identifier from its route boundary;
3. initialize the client model exactly once for that browser instance;
4. own release when the initialized model gains releasable resources; and
5. pass its route content to `shell.svelte`.

The shell calls the `$model/client` accessor. It must not construct the model,
import object constructors, or reach past that door.

## Sequence

1. Complete the client-model gate.
2. Generate the view and its component tree:

   ```sh
   pnpm new-view -- shell
   pnpm new-view-part -- shell components topbar
   pnpm new-view-part -- shell components context-panel --complex
   pnpm new-view-part -- shell components context-panel/components/rail
   ```

3. Move the layout markup and styles into `shell.svelte`.
4. Move the zone components and rewrite imports to `$views/shell/components/*`.
5. Fill `shell.md` and `components/components.md`; do not describe future panel
   behavior as implemented behavior.
6. Reduce the route layout to client-model lifetime, route content, and the
   root-view render.
7. Verify direct entry, navigation between child routes, panel widths, scroll
   ownership, and client-model instance stability before deleting
   `src/lib/shell/`.
8. Describe the route layout as the client-instance composition root wherever
   the shell is currently named as one.

The translation must not add exceptions. If the target tree fails the standard,
correct the tree or the standard rather than suppressing the diagnostic.

## Verification

```sh
pnpm lint
pnpm typecheck
pnpm test:scripts
pnpm test
pnpm build
```

Manual checks cover direct and nested navigation beneath `/app/[project]`.

```sh
rg '\$lib/shell|src/lib/shell' src docs
```

## Completion criteria

- `src/lib/views/shell/shell.svelte` is the only route import into the view.
- The view and its component directory have complete documents whose paths
  resolve.
- No empty concern directory or speculative abstraction was added.
- The shell remains browser-only, reads the initialized client model, and does
  not own durable application state.
- `src/lib/shell/` and all imports of it are gone.
- Structural lint, type checking, tests, build, and manual smoke checks pass.

## Follow-up, not part of this move

Activity and inspector content loaded from stable model keys needs a separate
view-level design. This translation moves only the permanent shell frame. The
key-to-component mapping will live in the view that renders the result.
