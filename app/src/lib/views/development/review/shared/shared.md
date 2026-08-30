# Review Shared

Lives at `src/lib/views/review/shared/shared.md`.

## What is here

One thing: the session. What is on the stage, the trace run everything below
registers into, and the snapshot of what the last render asked for.

## Why it is shared rather than the root's own state

The picker sets it, the state editor reads and invalidates it, and both trees
read the run out of it. Three components that know nothing about each other need
the same object, which is the definition of this concern.

## Why it is a class

`children` on a trace node has to be `$state`, and a rune cannot initialise a
property inside an object literal — so the node is a class, and the session that
holds one is written the same way for consistency. It is constructed per mount,
never at module load: two review pages open in two tabs must not share a
selection.

## Why the read log is a snapshot rather than a live read

A read happens inside `$derived`, and the log it writes to is
deliberately a plain `Map` — writing reactive state during a derivation is an
unsafe mutation, and making the log reactive would turn every panel render into
one. So the page reads it back a tick after the render instead, and re-reads
whenever an override changes what would be asked.

The cost is one frame of lag between a change and the read list catching up. The
alternative is a class of bug that only appears under a panel that reads twice,
which is most of them.

## Lifetime

The page's. Created when the view mounts, filled by every render under it, and
discarded with the view. The overrides a reader puts in belong to the session
too, so switching panels keeps them — and two review tabs never share one.
