# Archived orientation documents

Orientation documents exist to get someone productive on **work in flight**. When
the work lands they stop being that and become a mix of durable reasoning and stale
"what remains" — so they move here rather than sitting in
[`docs/orientation/`](../../docs/orientation/) looking current.

## How to read them

**The invariants and the mistakes outlive the work; the plan does not.** Each of
these was written to stop somebody breaking something subtle, and that part is
still worth reading before you touch the subsystem it covers. The status tables,
the "next steps" and the open questions are history.

Where an archived document and the code disagree, the code is right.

## What is here

- [`resilient-ingest.md`](resilient-ingest.md) — the write path of the knowledge
  lattice: bounded retries, self-contained window artifacts, sliced commits,
  streaming ingest, one indexed ascent. The programme is complete (records
  0152–0160).

  **Still worth reading, if you are changing `core/capability/knowledge/` or
  connector sync:** section 1 on why this subsystem's failures are silent rather
  than loud, section 4's invariants (each fails silently when broken), and section
  6's record of mistakes already made here — including two that were *committed*
  before being caught, and one gate that passed a deliberate break because its
  fixture happened to hide it.

  **Do not trust:** section 3's status table, section 8's "what remains", and the
  open questions. What is actually open is in
  [`docs/architecture/issues-and-gaps.md`](../../docs/architecture/issues-and-gaps.md)
  under *Ingest*.
