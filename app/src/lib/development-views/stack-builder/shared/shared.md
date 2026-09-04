# Stack Builder Shared

Lives at `src/lib/development-views/stack-builder/shared/shared.md`.

## What is here

One thing: the stack. What is in it, what order it is in, which entry is
selected, and what the whole thing is called.

## Why it is the only shared state

Three components that know nothing about each other need the same object — the
catalogue adds to it, the tree reorders it, the detail pane describes into it,
and the round reads it. That is the definition of this concern.

Nothing else qualifies. The catalogue never changes after load, so it is a value
computed once and passed as a prop rather than a session. The theme and the round
counter belong to the root and reach the frame as props. A second context for
either would be a lifetime where a variable would do.

## Why a factory rather than a class

Nothing here holds reactive children, which is the one thing an object literal
cannot express. A factory returning getters over `$state` says exactly what is
readable and what is writable, and the two writable values — the title and the
selection — are the two that have setters.

It is constructed per mount and never at module load. An instance made when the
module is imported would outlive the mount and be handed to the next one, so two
builder tabs would share a stack.

## Why ids are minted here

A node's id is the node's, not the component's: one stack holds three
`PanelStat`s showing three different things, and they are three nodes. Loading a
saved stack advances the counter past the highest id it read, so a node added
after an Open cannot collide with one that came back from disk.
