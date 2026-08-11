---
title: "Design — Text Lattice Ingestion Pipeline"
notion_page_id: "3acb6410e50281d19635f051bb5ee6ad"
notion_url: "https://app.notion.com/3acb6410e50281d19635f051bb5ee6ad"
project: "Taurus Yesod"
role: "Primary"
format: "Spec"
created: "2026-07-29 20:15:38Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Design — Text Lattice Ingestion Pipeline

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

> **Status:** Implementation-ready Taurus Yesod authority for the **Text lattice**, aligned to the current Taurus Omega `core/capability/knowledge` implementation. This document defines how eligible Resources, Files, and literal transcriptions become trusted text for semantic retrieval. It is one member of the three-lattice architecture defined in <mention-page url="https://app.notion.com/p/3acb6410e50281bf8f16ec589da555d3"/>. Resources and Files remain the source of truth.
## 1. The simple decision
The Knowledge capability owns the Text lattice. Each supported text projection therefore needs one job before it can enter this lattice: **produce the exact text that Taurus is willing to retrieve, together with locations that lead back to the original source.** Structured Data and Media descriptors never enter this lattice.
The current Knowledge capability already owns the rest:
- `Knowledge.Add` is a source-level upsert. Re-adding a `(project, source type, source ID)` replaces its stored text snapshot.
- An identical re-add is skipped without work.
- For changed text, Omega reuses existing vectors for byte-identical windows and embeds only new or changed windows.
- `AddBatch` already combines changed windows from many sources into bounded provider batches and commits their source writes together.
So this design does **not** add a mandatory “diff semantic units” system. A translator always emits the current full text snapshot, then calls `Add` or `AddBatch`. The existing lattice does the useful incremental work. More elaborate projector-level diffing can be considered later only if measurement shows it is needed.
> **Text-lattice rule:** retrieve only text that is present in the source or literally transcribed from it. Generated image descriptions, structured-data summaries, interpretations, and invented structure are prohibited here. Image descriptions belong only to Media; structured descriptors belong only to Structured Data.
## 2. What each layer owns
<table header-row="true">
<tr>
<td>Layer</td>
<td>Responsibility</td>
</tr>
<tr>
<td>Resource / File capability</td>
<td>Authorizes and provides one exact canonical revision or immutable file snapshot.</td>
</tr>
<tr>
<td>Ingestion translator</td>
<td>Turns that input into trusted text plus stable locations. It does not call a reasoning agent or mutate the source.</td>
</tr>
<tr>
<td>Knowledge capability</td>
<td>Windows, embeds, stores, clusters, retrieves, replaces, and reuses text windows.</td>
</tr>
<tr>
<td>Intelligence capability</td>
<td>Routes an embedding or OCR cast through configuration; it owns provider mechanics and credentials.</td>
</tr>
<tr>
<td>UI</td>
<td>Opens the cited Resource, turn, slide, page, or image region.</td>
</tr>
</table>
The minimum output of every translator is deliberately close to the current `knowledge.AddItem` input:
```go
type ProjectedText struct {
    SourceType string
    SourceID   string
    Label      string
    Revision   int64
    Text       string
    Locators   []LocatorSpan // one source-text range -> original location
}
```
`Text` is a complete, current source snapshot—not a collection of partial patches. `Locators` are the generalized successor to the current document-shaped `BlockSpan{RowID, BlockID, Start, End}`. The first implementation can continue using `BlockSpan` for Documents, but chat turns, slides, PDF pages, and OCR regions need a neutral form such as:
```go
type LocatorSpan struct {
    Start, End int
    Kind       string // document_block | chat_turn | slide | pdf_page | image_region | file_range
    ID         string // stable Taurus ID, File ID, or page/region identity
    ParentID   string // optional: chat, deck, or file identity
}
```
Retrieval should return these locations with the exact text range. This is a citation feature, not a new ingestion-diff mechanism.
## 3. Shared ingestion path
```plain text
exact canonical source or file snapshot
  → format-specific translator
  → ProjectedText (text + locations)
  → Knowledge.Add / Knowledge.AddBatch
  → existing window reuse, embedding batches, and lattice update
```
All ingestion must start from a server-authorized snapshot. The client may request an update, but it must not submit the text that becomes the knowledge source.
For a single edit, send one `Add`. For an import, connector sync, or many uploads, collect `ProjectedText` values and use `AddBatch`; it already batches changed windows under the configured embedding limit and backs off on rate limits.
The source revision still matters for staleness and diagnostics, but text plus locators determine whether an existing source is truly unchanged. That matches Omega’s present behavior and avoids needless work when an upstream sync sequence changes without changing content.
## 4. Source-to-text rules
### 4.1 Documents
Documents are the reference path. Translate the canonical Document revision into readable text in document order:
- headings and body text;
- lists, quotes, links, code, and supported table text;
- heading ancestry as a short prefix where useful for context;
- document row/block identities in locators.
Exclude prompt blocks, generated output, hidden runtime state, and anything not canonical user-authored document content. An image block is not described by this translator; it has its own image source and, if OCR yields text, the document may link to that image result.
### 4.2 Chats
Chat is intentionally simple: serialize the visible, completed conversation in stable turn order. Preserve who said what and keep the turn ID as the locator.
```plain text
Turn 14
User: “What did the customer say about procurement?”
Assistant: “They require SSO and a security review before pilot access.”
```
Include only user-visible, canonical conversation material: approved participant roles, persisted messages, and the selected branch. Exclude system/developer prompts, hidden reasoning, tool payloads, credentials, transient drafts, and deleted messages. Attachments are separate sources; do not paste attachment bytes into a chat turn.
The initial implementation may ingest a whole Chat as one `Source.Text`; turn locators preserve exact opening behavior. If a very large chat eventually needs a source-per-turn policy, that is an optimization and migration—not a requirement for V1.
### 4.3 Slides
Slides become an outline, not a prose document and not an AI-produced summary. For each included slide, emit only text that Taurus owns or can extract deterministically:
```plain text
Deck: Quarterly Review
Section: Results
Slide: 7
Title: Revenue growth
Body:
- Enterprise revenue increased 18% year over year.
Notes: Discuss the renewal cohort separately.
```
Use this stable order: deck and section context, visible title/text objects, text table content with labels, chart title/series labels/canonical values when Taurus owns them, then speaker notes. The slide ID—not its number—is the locator identity; the number is only a display aid.
Do not index animations, transitions, timing, speaker behavior, or anything visible only through a non-text visual interpretation. Images on a slide are separate image sources, associated with the slide for navigation.
### 4.4 Plain text and Markdown
These go straight through after bounded decoding. Preserve headings, paragraphs, list items, code blocks, and link text in source order. Keep line/byte-range locators. Never dereference URLs, includes, remote images, or executable directives as a side effect of ingestion.
### 4.5 PDFs
PDF ingestion is page-aware and does not require first making an editable Taurus Document.
1. Extract embedded page text in conservative reading order.
2. Preserve page number and text/bounding locations where the extractor supplies them.
3. If a page has no usable embedded text—such as a scan—render that page and send it through the OCR path.
4. For mixed PDFs, retain the native text and add OCR only for the parts that lack it; do not duplicate the same words.
Use a display prefix such as `annual-report.pdf — Page 23`, but retain the PDF page as the citation target. PDF import and PDF knowledge ingestion may share extraction code, but they have different outcomes: importing creates an editable Resource; ingestion creates searchable derived text. If a user imports a PDF into a Document and also retains the PDF, policy must choose whether to index one or both so retrieval is not duplicated.
## 5. Images: Media discovery plus optional OCR Text
An image may produce two mutually isolated projections. Media generates a descriptor that makes the original image discoverable; Text receives only literal OCR transcription when OCR policy admits it. No lattice record is shared between those projections.
<table header-row="true">
<tr>
<td>Path</td>
<td>Purpose</td>
<td>Outcome when unavailable</td>
</tr>
<tr>
<td>Media descriptor projection</td>
<td>Makes the original image discoverable through a generated description in the Media lattice.</td>
<td>Media admission remains incomplete; never substitute the descriptor into Text.</td>
</tr>
<tr>
<td>OCR</td>
<td>Makes literal visible writing retrievable as text.</td>
<td>The image has no text-based lattice entry; report a diagnostic if OCR was requested.</td>
</tr>
</table>
### 5.1 Media descriptor projection
The Media capability sends a server-authorized image snapshot through the dedicated `media.describe.image` inference cast. The structured result names, summarizes, and tags the image for Media discovery, records its provider/model/prompt provenance, and assesses whether visible text makes OCR useful. Media embeds the generated descriptor in its own lattice and returns the original image when retrieved. The descriptor is generated interpretation, never Text-lattice evidence. See <mention-page url="https://app.notion.com/p/3acb6410e50281dfa3abd6a5ed892917"/>.
Direct visual embeddings are deferred. If they are later introduced, they remain a Media concern and must not be compared with Text or Structured vectors without an explicitly proven joint space.
### 5.2 OCR
OCR is the trusted text path for an image. The worker receives the original or a normalized orientation-correct raster and returns only literal, visible writing and its locations:
```go
type OCRResult struct {
    Text    string
    Regions []OCRRegion // start/end in Text, image bounds, confidence
}
```
The OCR instruction and schema must be narrow: **transcribe visible text only; do not describe the image, infer missing words, complete cut-off text, translate, explain, or summarize.** Low-confidence material remains labeled as OCR and may be surfaced for review, but it is not silently “fixed” by a language model.
The OCR result becomes ordinary text windows through `Knowledge.Add`; `OCRRegion` values map retrieved text back to the image. A text-free image remains discoverable through its Media descriptor, but it receives no Text-lattice entry.
OpenRouter can support this route. Its image-input API sends an image to a vision-capable model, and its PDF parser exposes a Mistral OCR engine for scanned pages. In Omega, define OCR as an Inference cast with the purpose set to `ocr`, rather than hard-coding a model name or credential. The concrete route should be validated against the live OpenRouter model catalog because availability and capability change. Omega will also need typed image content in `intelligence.Message` before that cast can carry pixels to OpenRouter.
## 6. What is deliberately out of scope
- Spreadsheets, CSV, and other structured data are not flattened into the Text lattice. Their artifacts and descriptors belong to <mention-page url="https://app.notion.com/p/3acb6410e5028157b9e4e8228237cfb8"/>.
- Image captions, object labels, diagram explanations, and vision-generated summaries are prohibited as knowledge text.
- PDF-to-Document conversion is not required for PDF retrieval.
- Projector-level semantic-unit diffs are not required to get efficient updates; current `Add` already reuses unchanged windows.
- This document does not decide query planning, answer generation, or Context UI design.
## 7. Implementation sequence
1. **Generalize citations.** Replace the document-only `BlockSpan`/`BlockRef` assumption with a neutral locator span while preserving current Document behavior and API compatibility.
2. **Introduce a translator registry.** A `TextTranslator`, given an authorized exact snapshot, returns `ProjectedText`; it owns no persistence and calls no model.
3. **Add translators in value order.** Chat, Slides, plain text/Markdown, and PDF page extraction all feed the existing `Add` / `AddBatch` path.
4. **Add OCR as a narrow Intelligence extension.** Add typed image message parts; wire the `purpose: ocr` inference cast; validate strict OCR output, bounds, image/file limits, and result provenance.
5. **Wire Media separately.** Add typed image inputs and the `media.describe.image` cast through the Media capability. Keep Media descriptor storage, vectors, generations, and retrieval physically separate from Text. Direct visual embeddings remain deferred.
Every implementation must preserve project authorization, use an exact source version, bound file/image dimensions and decoded bytes, time-box parsers/workers, avoid fetching arbitrary URLs, and write stable diagnostics without exposing source text or credentials in logs.
## 8. Acceptance evidence
- A full Chat produces attributed text and opens the exact cited turn; internal prompts and tool data never appear.
- A Slide deck produces the expected outline, preserves slide navigation, and omits animation/transition behavior.
- A text PDF cites its original page; a scanned PDF indexes only its OCR transcription with region locations.
- OCR output contains only visibly transcribed text in a fixture corpus; it contains no captions, scene descriptions, inferred corrections, or translations.
- Re-adding unchanged translated text is skipped; changing one source section reuses the other unchanged lattice windows, as Omega already promises.
- A multi-file import uses `AddBatch`, stays within configured embedding batch limits, and produces no partial source replacement on an embedding failure.
- Media descriptors, Media vectors, and Media generations remain separate from Text; OCR may fail independently without contaminating either lattice.
## Sources
- [Current Knowledge source/upsert implementation](https://github.com/gccurtis/taurus-omega/blob/main/core/capability/knowledge/build.go)
- [Current Knowledge source, locator, and vector contracts](https://github.com/gccurtis/taurus-omega/blob/main/core/capability/knowledge/knowledge.go)
- [Current retrieval-region/citation contract](https://github.com/gccurtis/taurus-omega/blob/main/core/capability/knowledge/regions.go)
- [Current Intelligence cast and text-only endpoint contracts](https://github.com/gccurtis/taurus-omega/blob/main/core/capability/intelligence/intelligence.go)
- [Current OpenRouter adapter](https://github.com/gccurtis/taurus-omega/blob/main/core/integration/intelligence/openrouter/openrouter.go)
- [OpenRouter embeddings: text and image inputs](https://openrouter.ai/docs/api_reference/embeddings)
- [OpenRouter image-input guide](https://openrouter.ai/docs/guides/overview/multimodal/image-understanding)
- [OpenRouter PDF processing and Mistral OCR engine](https://openrouter.ai/docs/guides/overview/multimodal/pdfs)
## Multi-lattice authorities
- <mention-page url="https://app.notion.com/p/3acb6410e50281bf8f16ec589da555d3"/>
- <mention-page url="https://app.notion.com/p/3acb6410e5028157b9e4e8228237cfb8"/>
- <mention-page url="https://app.notion.com/p/3acb6410e50281dfa3abd6a5ed892917"/>
- <mention-page url="https://app.notion.com/p/3acb6410e502811cb1d8d52f81f4c432"/>

