# Processes

How things work. Algorithms, phases, and the settings that tune them.

The other two directories describe things at rest —
[data models](../data-models/) say what an object is,
[storage](../storage/) says what rows exist. Neither has anywhere to put a
procedure, and a procedure is not improved by being written as though it were a
record.

## What belongs here

A document belongs in this directory when it describes **something happening over
time** rather than something being true: a multi-step algorithm, a phase with
inputs and outputs, a policy applied on a schedule.

It also belongs here when it is **configuration rather than content** — settings
that live in [`app/configuration/`](../../app/configuration/) and have no table,
no author, and no project scope.

## Documents

**[Change conflicts](change-conflicts.md)** — how an incoming change set is
decided against what landed while its author was not looking. An escalating
ladder of checks, ending in apply-unmodified or reject.

**[Lattice clustering](lattice-clustering.md)** — ingestion, windowing, and the
two clustering modes. The exact pairwise path for small pools, and the
PCA-and-IVF path above the crossover.

**[Lattice retrieval](lattice-retrieval.md)** — embedding a query, narrowing the
frontier, best-first descent, and assembling regions under a budget.

**[Intelligence](intelligence.md)** — model and provider settings. Configuration,
not a model; the file exists to say so and to fix the vocabulary bindings are
named by.

## Why the lattice needs two of these

The [lattice data model](../data-models/knowledge/knowledge-lattice.md) is
unusually thin for how much it carries, because almost everything about it is
procedural. A node is a centroid, a member list, and some counts — the meaning is
entirely in how those were produced and how they are walked.

So the fields are documented where they are stored, and the reasons they exist
are documented here.

## Related

[data models](../data-models/) · [storage](../storage/) ·
[configuration](../../app/configuration/)
