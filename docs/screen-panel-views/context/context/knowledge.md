# Knowledge

| View | What it is for | Sections |
| --- | --- | --- |
| Knowledge | What can actually be retrieved from this scope, and what has been written against it | What can be retrieved · Generated blocks using this · Lattice, debug only |

Containing a resource and being able to retrieve from it are different things.
This view is about the second.

## Layout

| 300px |
| --- |
| what can be retrieved |
| generated blocks using this |
| generated blocks using this |
| lattice, debug only |

## What can be retrieved

The split between indexed and not, as two rows rather than a percentage.

**Shows** — *88 resources with indexed material*; *123 resources with nothing
indexed yet*

**Needs** — indexed counts over the resolved set.

**Open** — per-source health is limited to observed evidence until a
source-registry projection exists. "Nothing indexed yet" cannot currently
distinguish *not yet processed* from *cannot be processed*, and those need
different responses.

## Generated blocks using this

What has been written against this scope. It matters because changing the scope
changes what those blocks produce the next time they run.

**Shows** — *Outage summary* — In Q3 Resilience Memo; *Storm precedent brief* — In
Storm Hardening Options

**Needs** — `DerivedOutput` records referencing this `ResourceSet`.

**Open** — `DerivedOutput` stores no owner pointer, so finding the prompt block
that owns an output is a reverse query.

## Lattice, debug only

Retrieval internals. Starts collapsed and is labelled as debug, because nothing
here is editable and none of it is a product concept.

**Shows** — *Cluster · relay coordination* — tier 2 · 14 members

**Needs** — read access to lattice nodes over the scope.

**Open** — lattice nodes are system-managed. The view must not offer any action on
them, and must not suggest they are part of what a person configures.
