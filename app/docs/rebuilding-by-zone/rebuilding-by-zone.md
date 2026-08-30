# Rebuilding by zone

The fourteen mock capabilities are empty. Every view that called one no longer
compiles, and the compiler is the specification: each error names something a
capability owes a view.

This is the order that work happens in, and why.

## The frame

`routes/app/[project]/+page.svelte` renders `views/app`, which is four rows and
three columns. Every zone is a sibling view; placement belongs to the frame, so
no zone knows where it sits.

```
┌─────────────────────────────────────────────────────────┐
│  TopBar                                    44px, spans 3│
├─────────────────────────────────────────────────────────┤
│  TabBar                                    36px, spans 3│
├──────────────┬──────────────────────┬───────────────────┤
│ ContextPanel │  Core                │  Inspector        │
│              │   1fr                │                   │
├──────────────┴──────────────────────┴───────────────────┤
│  StatusBar                                 32px, spans 3│
└─────────────────────────────────────────────────────────┘
   CommandBar — outside the grid, dims all six
```

The three container zones load their contents with `import.meta.glob`, so each
owns a whole tree rather than an import list: `ContextPanel` over
`panels/context/`, `Inspector` over `panels/inspector/`, `Core` over
`workspaces/`.

Nothing renders outside this frame except `views/development`, which is the demo
and review pages. Those never called a mock capability and still compile.

## The order

Smallest first, and each one proves a capability the next one needs.

| | zone | needs | why here |
| --- | --- | --- | --- |
| 1 | **tab-bar** | `naming` | One error. A tab needs a name for the thing it is open on, which is the smallest real capability in the tree. |
| 2 | **status-bar** | `naming`, `collaboration`, identity | Four errors, and three of them are the same `naming` call the tab bar just proved. Identity — who the viewer is — arrives here for the first time. |
| 3 | **command-bar** | `formula`, `project` | The overlay and its one modal. Five errors, and it is where a command runs rather than where data is read. |
| 4 | **core** | `project`, `library`, `resource`, `analysis`, `agents`, `research` | The work surface, and the point of the application. Nine workspaces, 155 errors. |
| — | **context** | — | Emptied. See below. |
| — | **inspector** | — | Emptied. See below. |
| — | **top-bar** | — | Already compiles. |

Within core, `project-overview` comes first: 20 errors, and the capabilities it
needs — `project`, `library`, `collaboration`, `opening`, `inspecting` — are the
same ones the status bar and the modal are waiting on.

## Why the flanks are emptied rather than rebuilt

The two flanks hold 204 of the 218 view files and 986 of the 1,151 errors — 86%
of the problem, and none of it is the work surface. They are panels for
capabilities that do not exist, written against sample rows that disagreed with
representation. Rebuilding them before one workspace works end to end is
building the wide part first.

**The file names stay. Only the bodies go.** A panel's path is its key, and that
key is load-bearing in four places:

| | |
| --- | --- |
| `view-state/methods/shared/keys.ts` | generated from the tree — every key names a file |
| `view-state/methods/shared/rails.ts` | which context views a subscreen offers, by key |
| `context-panel/procedures/rail-entries.ts` | a label and an icon per key |
| `workspaces/**` | `inspect("resource.element", …)` and its siblings, as literals |

Deleting the trees would empty the first three and break every `inspect()` call
in the fourth — adding errors to the zone being rebuilt. Emptying the bodies
changes none of them: the rail still carries its labels, `inspect()` still names
something real, and every panel says what it is and that it is not built.

Each emptied panel is a to-do the checks already track. `panel-renders-alone`
proves it mounts; `key-vocabulary-matches-the-tree` proves nothing was lost.

## What a zone is done

A zone is finished when its files compile and its checks are clean. There is no
separate acceptance list, because a check that is not in `scripts/lint/` is a
rule nothing enforces.
