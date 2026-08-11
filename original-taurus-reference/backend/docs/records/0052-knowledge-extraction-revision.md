# Knowledge Extraction with Per-Source Revision (R17)

Refines knowledge extraction with revision-tagged sources and per-source
staleness detection, replacing the coarse project-level ChangedSince.

## What changed

- **knowledge.Source** — added `Revision int64` field. Stored alongside
  the source snapshot so the lattice knows which version of a document
  was indexed.

- **SQLite** — added `revision INTEGER NOT NULL DEFAULT 0` column to
  `knowledge_sources` with ALTER TABLE migration. `SourceByOrigin` reads
  it; `ReplaceSource` writes it.

- **knowledge.Add** — now accepts a `revision int64` parameter, passed
  through to the Source struct on upsert.

- **document.EvidenceSpan** — added `Revision int64` field. Evidence
  carries the source revision at time of retrieval.

- **document.SourceVersion** — added `Revision int64` field.
  `distinctOrigins` populates it from evidence spans.

- **Refresh gate** — replaced the project-level `ChangedSince` call with
  per-source revision checking (`sourcesChanged`). For each source the
  prompt was built from, compares the stored revision against the
  current document head. When no sources carry revision data (legacy),
  falls back to `ChangedSince`.

- **Dev handler** — `AddDocument` passes `doc.Revision` to `knowledge.Add`.

- **Windowing** — no change needed. The existing `windowSpans` already
  splits at `\n` boundaries (which correspond to block boundaries in the
  flat text), so small blocks stay together and only large blocks get split.

## Why

R17 from the document backend checklist. Previous refresh gating was
project-granular — any knowledge change triggered re-resolution of every
prompt block. Now each prompt block tracks which document revisions
grounded it, and refresh skips when those specific documents haven't
changed. The lattice still uses upsert (one source per document), not
multiple revision-tagged sources.
