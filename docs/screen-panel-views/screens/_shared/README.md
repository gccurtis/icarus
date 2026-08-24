# Shared surfaces

Surfaces that belong to no screen. They sit beside `screens/` rather than inside
one because a file under `screens/<screen>/` is a claim that the screen owns it,
and nothing here is owned by a tab.

The underscore is the same convention as [`_reference/`](../../_reference/): a
directory that is not one of the nine screens.

| Surface | What it is | File |
| --- | --- | --- |
| The status bar | The bar across the foot of every screen — the work, the Copilot, and you | [status-bar.md](status-bar.md) |

A shared surface is written against
[the workspace reference](../../_reference/workspace-reference.md), because it is
a plane with regions rather than a stack in a 300px column. Its lenses stay in
the global inspector tree — [`inspector/copilot/`](../../inspector/copilot/) is
the Copilot's, and it is a subject like any other.
