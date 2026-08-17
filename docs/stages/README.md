# Stages

The Convex data layer is brought into `main` in stages. Each one is agreed
before it is written, and each leaves the application working.

Every stage is two documents:

| | Answers | Written |
| --- | --- | --- |
| **design** | What the shape is, what it decides, and why it beat the alternative | Before any code |
| **build** | Which files, where, wired how, and what will check it | From the agreed design |

## Why the split

The design document is the argument. It is read once carefully, disagreed with,
and revised — and most of its value is in the sentences explaining why something
is *not* the obvious thing. The build document is a work order, read while
writing code, and it should be boring.

Keeping them apart means a design can be re-argued without touching the build
instructions, and the build can be corrected without disturbing settled
reasoning.

## Stages

| # | Stage | Tables | Design | Build |
| --- | --- | --- | --- | --- |
| 0 | Foundation | none | [design](0-foundation-design.md) | [build](0-foundation-build.md) |

Order and rationale are in
[storage/merge-order.md](../storage/merge-order.md), which also explains why a
strict topological sort of the tables does not exist.

## Where these came from

A full implementation of all 28 tables exists on the `convex-implementation`
branch — 1,541 tests, every pass built and adversarially reviewed. It is the
**reference, not the source.** Reviewing it stage by stage has changed the design
in ways that reach backwards, so `main` implements what these documents say
rather than what the branch did, and the branch is where to look for anything a
document leaves unchanged.

## Related

[merge order](../storage/merge-order.md) · [storage](../storage/) ·
[data models](../data-models/) · [processes](../processes/)
