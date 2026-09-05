# An external file

| Selecting | What it is | Sections |
| --- | --- | --- |
| An external file row | A file that came in from somewhere, and whether anything in it can be read | File · Extraction · Connector |

An external file is only useful once text has come out of it. This lens leads
with identity but exists mostly for the second section.

## Layout

| 300px |
| --- |
| file |
| extraction |
| extraction |
| connector |

## File

**Shows**

| | |
| --- | --- |
| Title | NERC-2025-winter-review.pdf |
| Type | PDF |
| Size | 4.2 MB |
| Origin | SharePoint — Ops Reports |

**Needs** — `ExternalFile` name, MIME type, size, and its source connector or
upload.

## Extraction

Whether text came out, and if not, why. The failure is stated as what it costs —
nothing in this file is retrievable until text comes out of it — rather than as
an error code.

**Shows** — `Could not read`, `Reason · Scanned document with no text layer`,
`Attempted · 4 days ago`, and **Retry extraction**

**Needs** — extraction state, failure reason, and last-attempt time.

**Open** — retrying an extraction that failed for a structural reason (no text
layer) will fail again. Either the retry is honest about that, or the reason
needs a retryable flag.

## Connector

Where it came from, and whether that source is still live. Starts collapsed.

**Shows** — `Connector · SharePoint — Ops Reports`, `Still syncing · No — authentication expired`

**Needs** — the owning `Connector` and its sync state.
