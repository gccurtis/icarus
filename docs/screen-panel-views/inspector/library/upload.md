# Upload

| Selecting | What it is | Sections |
| --- | --- | --- |
| Choose files, or files in flight | Files on their way into the project | Files · Ingestion |

## Layout

| 300px |
| --- |
| files |
| ingestion |

## Files

What is being uploaded, with size and type, so a wrong file is caught before it
lands.

**Shows** — *storm-log-2026-01.csv* — 1.1 MB · text/csv; *feeder-12-relay.pdf* — 820 KB · application/pdf

**Needs** — staged upload records with name, size and MIME type.

## Ingestion

Progress, and what happens after the bytes arrive.

**Shows** — `Uploading 2 of 2`

**Needs** — per-file upload progress, then extraction state.

**Open** — staged upload IDs survive a tab switch; raw file handles do not survive
a reload. An upload interrupted by a reload has to fail visibly rather than
appear to still be running.
