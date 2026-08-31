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

| | step | needs | why here |
| --- | --- | --- | --- |
| 1 | **tab-bar and status-bar** | `naming`, `collaboration`, identity | Both ask `naming` what the thing behind an id is called, and they are its only two callers. Split apart, the second one rebuilds what the first one just built. |
| 2 | **the function builder** | `formula`, `project` | The one surviving modal. It is where a command runs rather than where data is read, which is the other half of what a capability is. |
| 3 | **the client models** | nothing | `$shared` and `$revisions` are not aliases. Not a capability question at all. |
| 4 | **the workspaces** | `project`, `library`, `resource`, `analysis`, `agents`, `research` | The work surface, and the point of the application. Nine of them, and three quarters of the remaining errors. |

Steps 1 and 3 are what the application boots on. The status bar and the client
models are both imported eagerly, so until each compiles Vite serves a 500 and
nothing renders — including the zones that are already finished. A workspace is
reached through a glob and fails alone.

The two flanks and the top bar are not in the list. The flanks are emptied, and
the top bar already compiles.

### Inside step 4

Most of the time here goes to the stable workspaces — the ones with the most
design behind them — rather than to whichever has the most errors. An error
count measures how much a workspace asks for, not how settled its answer is.

## Why the flanks are emptied rather than rebuilt

The two flanks held 204 of the 218 view files and 86% of the errors — none of it
the work surface. They were panels for capabilities that do not exist, written
against sample rows that disagreed with representation. Rebuilding them before
one workspace works end to end is building the wide part first.

**The design was kept and the components were not.** Each of the seventeen
subject directories holds a document saying what its panels are, what each one
shows, and where it routes. The components are gone.

**The vocabulary outlived the tree.** `panel-keys.ts` is hand-written and names
every panel this application intends to have, so a key whose file does not exist
is a panel not built yet rather than a broken reference. Both containers render
a placeholder that names the key it was sent, which is what keeps the rail, every
`inspect()` call, and every context id pointing at something real.

The vocabulary is the plan; the tree is progress against it.

## When a zone is done

A zone is finished when its files compile and its checks are clean. There is no
separate acceptance list, because a check that is not in `scripts/lint/` is a
rule nothing enforces.
