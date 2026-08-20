# Vocabulary Shared

Lives at `src/lib/views/vocabulary/shared/shared.md`.

## What is here

One thing: the review log every note on the page is written to and read back
from. It is shared because the notes belong to the page rather than to any one
row — the header counts them, and every row reads the ones addressed to it — and
a value two unrelated components both need is the definition of this concern.

## Why it is not a component's state

A note box sits beside a table row, an entry, and a section heading, in five
sections that know nothing about each other. Threading the list down through
every one of them would put the log in the contract of components that have no
opinion about it. Context is what lets the ones that care ask.

## Why it is a constructor rather than an instance

The rule the directory standard enforces, and it applies here for the ordinary
reason: a view can be mounted more than once, and two mounts sharing one list
would show each other's notes. The page root calls the constructor once and
provides the result; nothing here is built at module load.

## Lifetime

The page's. It is created when the view mounts, filled by one read, and
discarded with the view. Nothing about it outlives the page, because the durable
copy is the file on disk, not this list.
