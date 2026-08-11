# Deferred — pdf / docx import & export

**Decided:** 2026-07-27 · **Backend ready:** ❌ no · **Revisit:** long term

## The decision

Alpha is **not pursuing pdf or docx import/export**, and is **not asking Omega to build it**. Long
term, not next.

## What exists today, and works

Markdown round-trips for real:

- **Export** — `GET /documents/:id/export` returns Markdown; the document bar's **Export** button
  downloads it (`exportDocumentMarkdown` → `downloadMarkdown`).
- **Import** — upload the bytes (`POST /files`), then create from the file id
  (`POST /documents/import`). `importMarkdownFile` does both.

So "get a document in and out of Taurus" is a solved problem. What is missing is only the two
proprietary-ish formats.

## Why we are deferring

- **Markdown covers the real need.** It is what people paste into and out of a document editor.
- **The cost is disproportionate and lands on the backend.** Faithful docx means the OOXML
  package; faithful pdf means layout, fonts, and pagination — and Alpha deliberately **removed**
  pagination (documents render as one continuous flow). There is no page model left to export
  from, which is the honest blocker: pdf export would mean re-introducing a layout engine solely
  to serve it.
- **Import is worse than export.** Ingesting docx/pdf means mapping arbitrary foreign structure
  onto our seven block kinds, and the failure mode is silent mangling rather than a clean error.

## What this means for the backend

**Nothing is requested.** Do not build a converter service or an export format negotiation for
Alpha's sake. If Omega wants these for another consumer, that is Omega's call — Alpha will not
consume them until this file moves.

## What would change our mind

- A concrete user requirement to hand a **pdf to someone outside Taurus** that Markdown or a
  printed page cannot satisfy.
- **Import demand specifically** — people arriving with existing docx corpora. That is the case
  that would justify the mapping work, and it is the more likely of the two.
- A credible **off-the-shelf conversion path** on the Omega side, so the cost is integration rather
  than implementation.

Note the pagination point above if pdf export is ever revisited: it is a product decision
(continuous flow) before it is an engineering one.
