# Stage 0 — foundation

The vocabulary every table is written in. Three capabilities — `shared`,
`content`, `messages` — none of which declares storage, which makes this the one
point where the model can be argued about without a table in the way.

| | Answers | Written |
| --- | --- | --- |
| [design](0-foundation-design.md) | What the shape is, what it decides, and why it beat the alternative | Before any code |
| [build](0-foundation-build.md) | Which files, where, wired how, and what will check it | From the agreed design |

## Why the split

The design document is the argument. It is read once carefully, disagreed with,
and revised — and most of its value is in the sentences explaining why something
is *not* the obvious thing. The build document is a work order, read while
writing code, and it should be boring.

Keeping them apart means a design can be re-argued without touching the build
instructions, and the build can be corrected without disturbing settled
reasoning.

## What comes after

The Convex data layer is brought into `main` one stage at a time, each agreed
before it is written and each leaving the application working. Later stages get
their own sibling directory — `stage-1`, `stage-2` — with the same two
documents.

**A strict topological sort of the tables does not exist.** `Actor` is embedded
in most of them and references `agentTasks`, which carries an `Actor` itself. So
stage order is chosen for reviewability rather than derived from the schema, and
the cycle is cut by holding a reference as `v.string()` until its table lands.

Next is **revisions** — `resourceSnapshots` and `changeSets` — because a
resource row carries no body, so nothing with content can be discussed before it.

## Where this came from

A full implementation of all 28 tables exists on the `convex-implementation`
branch — 1,541 tests, every pass built and adversarially reviewed. It is the
**reference, not the source.** Reviewing it stage by stage has changed the design
in ways that reach backwards, so `main` implements what these documents say
rather than what the branch did, and the branch is where to look for anything a
document leaves unchanged.

## Related

[data models](../data-models/) · [processes](../processes/)
