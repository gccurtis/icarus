# Agents reference

The Agents category, staged live at `/app/<project>/reference/agents` and reached
from `/demo/agents-reference`. Seventeen pages in four groups: the built agents
surfaces staged live; the research chat as it was built; four specifications —
personas, tasks, automations, and research chat whole; and two records of the
rebases onto the derived output branch.

A specification page has one shape: state, then behaviour over that state, then
every procedure as a chain of what it takes, each step with the function that
performs it and the row it writes, what it refuses and what it refreshes, then
the execution flow as a diagram. It says what is not built as plainly as what is.

## What it is for

Each page stages the built surface inside a workspace state of its own, over the
project's real store, so a click on a page does what a click in the app does and
an edit is written. Under each stage sit the behaviours as tables, the writes
each control makes, and the decisions taken while building, numbered so they can
be answered by number.

The response page carries a mock rather than a stage, because neither the table
tool nor the chart system exists yet; what it is for is having the argument
before either is built.

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
