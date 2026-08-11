---
title: "Work Packet — Ω-030 — Implement image descriptors and OCR-derived text"
notion_page_id: "3adb6410e50281e78526ddb3cda469e4"
notion_url: "https://app.notion.com/3adb6410e50281e78526ddb3cda469e4"
project: "Taurus Yesod"
role: "Supporting"
format: "Spec"
created: "2026-07-30 00:08:50Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Work Packet — Ω-030 — Implement image descriptors and OCR-derived text

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

**Type:** Supporting  
**Wave:** 3 — Complete ingestion, retrieval, and connectors  
**Gate:** Project Backend Complete  
**Depends on:** Ω-004, Ω-009, Ω-014, Ω-028  
**Unblocks:** Ω-031, Ω-032
## Outcome
Media becomes an independent Project capability and lattice for PNG, JPEG, and
WebP still images. A vision-capable inference cast generates a validated
description for discovery. The original authorized image remains the artifact
the Agent opens. When policy selects OCR, a separate OCR cast emits literal
regioned text into the Text lattice with explicit OCR provenance.
V1 does not directly embed image pixels and does not support audio or video.
## Current evidence
Files can store opaque bytes, and Document/Slides/Chat can reference images, but
Omega has no Media capability, multimodal Intelligence message parts, image
descriptor schema, OCR policy, Media lattice, or OCR Text provenance.
## Before and after
```plain text
core/capability/media/
  model.go descriptor.go ingestion_image.go ocr.go
  service.go store.go tools.go lattice_adapter.go errors.go
core/integration/media/image/
core/platform/storage/sqlite/sqlite_media.go
core/handlers/media/
Intelligence typed image parts and media casts
```
## Scope
- Safe PNG/JPEG/WebP metadata decode and normalized model input.
- Image descriptor, tags, visible-text assessment, and Media lattice.
- OCR policy `never | auto | always`, regioned result, and Text admission.
- Original File reference hydration and parent Resource locators.
- Jobs, receipts, replacement/removal, API, authorization, telemetry.
## Non-goals
- No audio, video, audio transcription, animated frame analysis, image editing,
	chart-data extraction, or direct image-vector embedding.
- Generated descriptions never become Text-lattice source evidence.
- No arbitrary remote image URLs in capability/provider contracts.
## Governing invariants
1. The descriptor discovers an image; grounded visual use opens the original
	authorized immutable image.
2. Media descriptor and OCR Text are distinct projections with distinct IDs,
	rows, vectors, generations, and provenance.
3. OCR is literal transcription, not description, summary, translation, or
	inferred completion.
4. The provider sees a server-authorized normalized image input, not a
	caller-provided URL/base64 authority.
5. Source and File access are checked at ingestion and every hydration.
6. Decode dimensions/bytes/pixels precede expensive model calls.
7. Descriptor/OCR results validate against strict JSON/size/region schemas.
8. Replacement publishes atomically and retracts superseded projections.
## Core model
```go
type MediaArtifact struct {
    ID, ProjectID, SourceID string
    Kind        string // image
    Locator     MediaLocator
    Payload     MediaPayloadRef
    ContentHash string
    Descriptor  MediaDescriptor
}

type MediaDescriptor struct {
    Name, Summary, MediaKind, Setting, Purpose string
    Subjects         []DescriptorSubject
    Composition      []string
    VisualAttributes []string
    Tags             []MediaTag
    VisibleText      VisibleTextAssessment
    Confidence       float32
    Status           string
    Provenance       DescriptorProvenance
}

type OCRResult struct {
    Text       string
    Regions    []OCRRegion
    Language   string
    Confidence float32
    Provenance OCRProvenance
}
```
## Intelligence contracts
```plain text
inference / media.describe.image
inference / media.ocr.image
embedding / media.index
```
```go
type MessagePart struct {
    Kind  string // text | image
    Text  string
    Image *AuthorizedImageInput
}

type AuthorizedImageInput struct {
    FileID, SHA256, MIMEType string
}
```
Provider adapters resolve bytes through an infrastructure FileReader. Decode and
re-encode pixels to a bounded canonical model-input format to strip EXIF,
profiles, comments, and parser-ambiguous payloads; preserve the untouched
original File for artifact reads.
Default OCR policy is `auto`. The descriptor call already returns
`VisibleTextAssessment`; do not add a third call merely to decide whether to run
OCR.
## Persistence
```sql
CREATE TABLE media_sources (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL,
  source_ref_json TEXT NOT NULL, format TEXT NOT NULL,
  width INTEGER NOT NULL, height INTEGER NOT NULL, byte_size INTEGER NOT NULL,
  policy_version TEXT NOT NULL, generation INTEGER NOT NULL,
  status TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);

CREATE TABLE media_artifacts (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL, source_id TEXT NOT NULL,
  locator_json TEXT NOT NULL, payload_ref_json TEXT NOT NULL,
  content_hash TEXT NOT NULL, descriptor_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE media_ocr_projections (
  id TEXT PRIMARY KEY, project_id TEXT NOT NULL, source_id TEXT NOT NULL,
  text_projection_id TEXT, status TEXT NOT NULL,
  result_json TEXT, policy_version TEXT NOT NULL,
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
```
Add a separate `media_lattice_*` table family. Original bytes remain in
File/object storage.
## HTTP surface
```javascript
GET  /media/artifacts?sourceID=&cursor=&limit=
GET  /media/artifacts/:artifactID
GET  /media/artifacts/:artifactID/content
POST /media/search
POST /media/artifacts/:artifactID/ocr
GET  /media/artifacts/:artifactID/ocr
PATCH /media/artifacts/:artifactID/descriptor
```
## Ordered implementation tasks
1. Freeze image/descriptor/OCR/provenance schemas, limits, and fixture corpus.
2. Add typed Intelligence image parts and startup route-capability validation.
3. Implement safe PNG/JPEG decoders with standard library and WebP using a
	pinned BSD-licensed `golang.org/x/image/webp` dependency if retained.
4. Implement normalized provider input, description job, JSON validator, and
	Media artifact/lattice store.
5. Implement OCR policy/job, region validator, and narrow Text-admission port.
6. Add parent Resource locators, replacement/retraction, API, authorization,
	pagination, telemetry, and Agent open port.
7. Add adversarial image/OCR, recovery, load, live, and companion tests.
## Security, concurrency, jobs, and observability
- Bound compressed bytes, decoded pixels, dimensions, frames, metadata, model
	input, OCR text, region count, and output JSON before allocation/publication.
- Reject polyglots, invalid signatures, animated formats, external references,
	and decompression bombs.
- Do not send EXIF GPS or hidden metadata to providers or return it unless an
	explicit future contract authorizes it.
- Jobs are Project/source/policy scoped, idempotent, cancellable, retry/cost
	bounded, and stale-generation safe.
- Emit image dimensions/bytes, normalization bytes, descriptor/OCR state,
	visible-text decision, regions/text length, tokens/cost, and safe failure
	code—not image content or OCR text.
## Verification
- Valid PNG/JPEG/WebP and adversarial/truncated/polyglot/huge-dimension corpus.
- Descriptor schema hallucination/malformed-output rejection.
- OCR exact-text/region/confidence/provenance fixtures and empty OCR.
- Media and OCR Text rows are physically separate yet share the same immutable
	source reference.
- Access revocation blocks original open and OCR retrieval.
- Crash/retry/supersede/delete; no stale projection publish.
- Backend E2E: ingest image, search descriptor, open original, auto-OCR, retrieve
	literal OCR text with source region.
## Migration and rollback
All tables/routes are additive. Enable each image format only after its decoder
suite is green. OCR may be disabled by policy without disabling Media. Derived
descriptors/OCR can be regenerated; user-verified edits and provenance must be
backed up. Rollback unregisters the projector and leaves isolated rows.
## Completion evidence
- Security/parser/model/store/lattice/live matrices pass.
- A dual-projection E2E proves no record is shared across lattices.
- Provider input contains normalized pixels and no arbitrary URL.
- FOSS license/SBOM review is attached; audio/video are absent.
## Sources
- Taurus Yesod Model — Media capability
- Taurus Yesod Design/Implementation — Multi-lattice ingestion
- [`golang.org/x/image/webp`](https://pkg.go.dev/golang.org/x/image/webp)[ package and BSD-3-Clause license](https://pkg.go.dev/golang.org/x/image/webp)
- `core/capability/file`
- `core/capability/intelligence`
- Ω-028 typed router
---

