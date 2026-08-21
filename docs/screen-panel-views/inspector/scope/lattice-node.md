# A lattice node

| Selecting | What it is | Sections |
| --- | --- | --- |
| A node in Knowledge → Lattice, debug only | Retrieval internals, for debugging | Node · Windows · Contradiction |

Not a product concept. It is here so retrieval behaviour can be investigated when
a scope returns something unexpected, and nothing in it is editable.

## Layout

| 300px |
| --- |
| node |
| windows |
| contradiction |

## Node

**Shows** — `Tier · 2`, `Level · cluster`, `Members · 14`

**Needs** — read access to the lattice node record.

## Windows

Starts collapsed.

**Shows** — `Windows · 41`, `Density · 0.37`, `Cohesion · 0.72`

**Needs** — the node's window statistics.

## Contradiction

**Open** — the knowledge model describes a singular `parentId` tree while the
clustering process describes overlapping cliques. A node can belong to several
clusters or to one parent, and the two descriptions cannot both be right. This
view must not promise a definitive parent hierarchy until that is resolved.
