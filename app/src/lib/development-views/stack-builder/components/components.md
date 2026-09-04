# Stack Builder Components

Lives at `src/lib/development-views/stack-builder/components/components.md`. This is the
one document for the complete component tree.

## Component Tree

```text
stack-builder.svelte
├── catalogue.svelte        the list region
├── stack-tree.svelte       the stack region
├── entry-detail.svelte     the detail region
├── generate-panel.svelte   the round
└── mock-frame.svelte       the iframe
```

No component declares its own `grid-area`. The root wraps each one in the region
element, so a child can be rendered somewhere else — or in a test — without
carrying an opinion about where it sits.

## Why the catalogue does not drill down

Families are disclosures that open in place. A drill-down would need a back
control and would cost the reader the comparison they came for, and a screen that
needs a back control is the wrong screen.

## Why a stack row is both a `Draggable` and a drop target

Reordering and moving-into are the same gesture with a different target, so they
are the same component: a row receives another row's id and the caller decides
what that means. The catalogue's ids carry a `/` and the stack's do not, which is
how one handler tells "add this component" from "move this row".

## Why the detail pane writes on every keystroke

The description is the thing the round is actually asked to satisfy, and a
description that needs a second gesture to keep is one that does not get written.
There is no save step for it; the stack holds it, and Save writes the stack.

## Why the mock frame is an iframe with no attributes but `sandbox`

It takes a URL and a revision and nothing else. The revision is in the query
string because the file's address never changes, and a browser that re-served
from cache would show the previous mock and read as a frozen frame.
