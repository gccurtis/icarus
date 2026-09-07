# Agents reference

The Agents category, staged live at `/app/<project>/reference/agents` and reached
from `/demo/agents-reference`. Nine pages: an overview, one page per pane of the
shell, one per content surface, and one for the rows and doors behind them.

## What it is for

Each page stages the built surface inside a workspace state of its own, over the
project's real store, so a click on a page does what a click in the app does and
an edit is written. Under each stage sit the behaviours as tables, the writes
each control makes, and the decisions taken while building, numbered so they can
be answered by number.

It lives under the project route rather than under `/demo` because every surface
reads the agents capability, and a remote function resolves its scope from the
project in the page's path.

## The review gutter

Every row carries a note box in a column down the right. A note is appended to a
file on disk the moment it is entered, through this view's own route, and reads
back on the next load. Notes are keyed by page, scope and the row's label.

## Boundary

This view owns the stages, the page records and the questions. It does not own
the surfaces it stages, the vocabulary they compose, or the category it describes.

## Concerns

- [`components/`](components/components.md)
- [`procedures/`](procedures/procedures.md)
- [`shared/`](shared/shared.md)
