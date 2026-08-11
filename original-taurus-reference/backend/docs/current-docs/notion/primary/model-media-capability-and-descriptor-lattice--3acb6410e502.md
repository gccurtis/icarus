---
title: "Model — Media Capability & Descriptor Lattice"
notion_page_id: "3acb6410e50281dfa3abd6a5ed892917"
notion_url: "https://app.notion.com/3acb6410e50281dfa3abd6a5ed892917"
project: "Taurus Yesod"
role: "Primary"
format: "Spec"
created: "2026-07-29 21:25:01Z"
mirrored_at: "2026-07-30"
mirrored_from_notion: true
---

# Model — Media Capability & Descriptor Lattice

> Source mirror. Preserve this page as planning evidence; use the agent-facing execution packet when one exists.

> **Status:** Implementation-ready Taurus Yesod authority for the Media capability and Media descriptor lattice. V1 supports still images. Audio, video, and transcription are deferred but fit the same contracts.
## 1. Product and capability contract
Media makes non-text visual artifacts discoverable without pretending that their generated descriptions are literal source text.
```plain text
generated descriptor
  helps Taurus find the media

original media artifact
  is what the agent receives and uses
```
Media owns:
- project-scoped media-source admissions;
- original-media artifact references;
- generated descriptors and tags;
- descriptor embeddings;
- its separately persisted Media lattice;
- image-description and OCR job coordination through Intelligence ports;
- search, inspect, and read functions.
Media does not own Files, object storage, Knowledge text, or model-provider mechanics.
## 2. Scope
### V1
- PNG;
- JPEG;
- WebP;
- image descriptors generated through a dedicated vision-capable inference cast;
- optional or automatic OCR through a dedicated OCR cast;
- Media lattice search;
- original-image read/open results;
- OCR-derived text projection admission through a narrow Text admission port.
### Deferred
- audio and video;
- audio transcription;
- animated-image frame analysis;
- direct image embeddings;
- automatic chart-data extraction;
- image editing or generation;
- treating a generated image description as Text-lattice evidence.
## 3. Core model
```go
type MediaSource struct {
    ID            string
    ProjectID     string
    Source        SourceVersionRef
    MediaType     string // image; audio/video later
    Format        string // png | jpeg | webp
    Width         int
    Height        int
    ByteSize      int64
    PolicyVersion string
    Generation    int64
    Status        string
    AddedAt       time.Time
    SyncedAt      time.Time
}

type MediaArtifact struct {
    ID          string
    ProjectID   string
    SourceID    string
    Kind        string // image
    Locator     MediaLocator
    Payload     MediaPayloadRef
    ContentHash string
    Descriptor  MediaDescriptor
    CreatedAt   time.Time
}

type MediaLocator struct {
    FileID       string
    ParentKind   string // slide | document | chat | connector_item | standalone
    ParentID     string
    ElementID    string
    Region       *ImageRegion
}

type MediaPayloadRef struct {
    FileID     string
    SHA256     string
    MediaType  string
    ByteSize   int64
    Width      int
    Height     int
}
```
The Media capability stores a server-authorized reference to the original immutable File snapshot. It does not duplicate arbitrary image bytes into its lattice tables.
## 4. Descriptor model
```go
type MediaDescriptor struct {
    Name             string
    Summary          string
    MediaKind        string
    Subjects         []DescriptorSubject
    Setting          string
    Purpose          string
    Composition      []string
    VisualAttributes []string
    Tags             []MediaTag
    VisibleText      VisibleTextAssessment
    Confidence       float32
    Status           DescriptorStatus
    Provenance       DescriptorProvenance
}

type VisibleTextAssessment struct {
    Likelihood     float32
    OCRRecommended bool
    Reason         string
}

type DescriptorProvenance struct {
    SourceVersion  SourceVersionRef
    PolicyVersion  string
    PromptVersion  string
    Provider       string
    Model          string
    GeneratedAt    time.Time
}
```
The description is explicitly a generated interpretation. It may state what appears in the image and why it may be useful for retrieval, but it cannot become a source quote or a Text-lattice citation.
Example:
```json
{
  "name": "Customer retention cohort chart",
  "summary": "A line chart comparing monthly retention for the January through April customer cohorts.",
  "mediaKind": "chart",
  "subjects": [
    {"kind": "metric", "name": "customer retention"},
    {"kind": "time", "name": "monthly cohorts"}
  ],
  "purpose": "Cohort retention comparison",
  "tags": [
    {"namespace": "topic", "value": "retention"},
    {"namespace": "format", "value": "line_chart"}
  ],
  "visibleText": {
    "likelihood": 0.94,
    "ocrRecommended": true,
    "reason": "The chart contains a title, axes, legend, and data labels."
  },
  "confidence": 0.91
}
```
## 5. Image ingestion
```plain text
authorized immutable image snapshot
  → signature and image-bound validation
  → safe normalization metadata
  → image-description inference
  → descriptor validation
  → media artifact + descriptor embedding
  → atomic Media generation publication
  → OCR policy decision from descriptor result
  → optional dedicated OCR job
  → optional OCR Text projection admission
```
The image-description call is required for Media-lattice admission. Because that call already sees the image, its structured response also supplies the visible-text assessment. Taurus does not pay for a separate model call merely to classify whether OCR might be useful.
## 6. Intelligence casts
```plain text
inference / purpose: media.describe.image
inference / purpose: media.ocr.image
embedding / purpose: media.index
```
The `media.describe.image` route must resolve to a model that accepts typed image input and structured JSON output. The `media.ocr.image` route may resolve to a different model optimized for transcription.
Current Omega `intelligence.Message` and embedding inputs are text-only. Media requires typed multimodal message parts:
```go
type MessagePartKind string

const (
    PartText  MessagePartKind = "text"
    PartImage MessagePartKind = "image"
)

type MessagePart struct {
    Kind  MessagePartKind
    Text  string
    Image *AuthorizedImageInput
}

type AuthorizedImageInput struct {
    FileID   string
    SHA256   string
    MIMEType string
}
```
The Media capability passes only a server-authorized File reference. The provider adapter resolves bytes or a short-lived internal URL according to infrastructure policy; callers never submit arbitrary remote image URLs as authority.
## 7. OCR policy
```go
type OCRMode string

const (
    OCRNever  OCRMode = "never"
    OCRAuto   OCRMode = "auto"
    OCRAlways OCRMode = "always"
)

type MediaIngestionPolicy struct {
    OCRMode                OCRMode
    OCRLikelihoodThreshold float32
    MaxImageBytes          int64
    MaxImagePixels         int64
    MaxOCRTextBytes        int64
}
```
Default: `auto`.
- `never`: create the Media descriptor only.
- `auto`: run OCR when the description result recommends it and the likelihood meets the configured threshold.
- `always`: run OCR for every admitted image.
The upload or connector UI may override the project default for one source. The receipt shows whether OCR was not requested, skipped by policy, completed, empty, or failed.
OCR instructions are strict:
> Transcribe literal visible text. Preserve reading order and regions. Do not describe, summarize, translate, infer missing words, complete cut-off text, or silently correct low-confidence text.
## 8. OCR result and Text projection
```go
type OCRResult struct {
    Text       string
    Regions    []OCRRegion
    Language   string
    Confidence float32
    Provenance OCRProvenance
}

type OCRRegion struct {
    ID         string
    Start      int
    End        int
    Bounds     ImageRegion
    Confidence float32
}

type OCRTextProjection struct {
    ProjectionID string
    ProjectID    string
    Source       SourceVersionRef
    Label        string
    Text         string
    Locators     []TextLocatorSpan
    Provenance   TextProjectionProvenance
}
```
The projection is admitted through a narrow port supplied by wiring:
```go
type OCRTextAdmitter interface {
    ReplaceOCRText(
        ctx context.Context,
        scope Scope,
        projection OCRTextProjection,
    ) (TextAdmissionReceipt, error)
}
```
Media never imports the Knowledge service package. The adapter translates `OCRTextProjection` into the Knowledge/Text admission contract.
The Text lattice records provenance such as:
```plain text
origin_kind: image_ocr
source_media_artifact_id: media_artifact_42
source_version: sha256:...
ocr_provider: ...
ocr_model: ...
ocr_policy_version: ...
```
Retrieved OCR text returns literal text and image-region citations. It never returns the generated Media description as evidence.
## 9. Media lattice entry
Each image normally produces one descriptor entry:
```go
type MediaLatticePayload struct {
    ArtifactID string
    Name       string
    Summary    string
    Tags       []MediaTag
}
```
The embedded descriptor string is deterministically serialized:
```plain text
Name: Customer retention cohort chart
Kind: line chart
Summary: A line chart comparing monthly retention for the January through April customer cohorts.
Subjects: customer retention; monthly cohorts
Purpose: Cohort retention comparison
Tags: retention; line chart
```
Do not embed raw image bytes or OCR text into the Media descriptor lattice. OCR text belongs to Text. Direct visual embeddings, if later adopted, require a separately named Media vector mode and cannot be compared to descriptor-text vectors unless a proven joint embedding space is configured.
## 10. Search and read
```go
type MediaSearchRequest struct {
    Query      string
    Tags       []TagFilter
    SourceIDs  []string
    ParentIDs  []string
    TopK       int
}

type MediaMatch struct {
    ArtifactID string
    Name       string
    Summary    string
    Tags       []MediaTag
    Locator    MediaLocator
    Relevance  float64
    Confidence float32
}

type MediaReadRequest struct {
    ArtifactID string
    Region     *ImageRegion
}

type MediaReadResult struct {
    Artifact   MediaArtifactView
    Access     AuthorizedMediaAccess
    Descriptor MediaDescriptor
    OCR        *OCRSummary
}
```
Search finds descriptors. Read returns authorized access to the original image and optionally the associated OCR status or text-projection reference.
Agent tools:
```plain text
media.search
media.inspect
media.open
media.list
```
The model does not provide `ProjectID`; execution scope supplies it.
## 11. Source relationships
An image may be:
- a standalone uploaded File;
- a connector item;
- a Document image block;
- a Slide visual object;
- a Spreadsheet image overlay;
- a Chat attachment.
The Media artifact points to both the canonical File snapshot and the containing Resource element when present. Deleting a containing element removes that relationship; deleting the underlying File authority removes the artifact and all derived projections according to retention policy.
The same File version should be admitted once per project-policy identity and may have multiple parent relationships. Do not pay for duplicate descriptions merely because one image appears in several Resources.
## 12. Refresh and partial success
Refresh keys:
```plain text
source SHA-256
+ descriptor policy/prompt version
+ descriptor model identity
+ OCR policy/prompt version
+ OCR model identity
```
Rules:
- unchanged image + unchanged descriptor policy/model → reuse descriptor and vector;
- unchanged image + changed OCR policy → rerun only OCR as required;
- unchanged image + changed descriptor policy/model → regenerate descriptor and Media vector;
- changed image → create a new artifact generation and evaluate both branches;
- descriptor success + OCR failure → Media is complete; OCR branch is failed/needs-attention;
- OCR success + descriptor failure → OCR text may be retained as a staged result, but Media generation is not published until its required descriptor succeeds.
## 13. Persistence
```plain text
media_sources
media_artifacts
media_artifact_relations
media_descriptors
media_tags
media_ingestion_attempts
media_ocr_results

media_lattice_entries
media_lattice_nodes
media_lattice_memberships
media_lattice_level_indexes
media_lattice_generations
```
Required invariants:
- project scope repeated in every read and write;
- File/source version immutability;
- unique admission by source version and policy identity;
- descriptor provenance and confidence;
- exact separation from Text and Structured lattice tables;
- atomic Media generation publication;
- OCR result lineage to the Media source without shared lattice IDs;
- derived-data deletion and retention enforcement.
## 14. Security and limits
- Validate image signatures instead of trusting extensions.
- Decode in a resource-limited worker or hardened library path.
- Reject decompression bombs, absurd dimensions, unsupported color/profile data, malformed frames, and limit overflow.
- Normalize orientation for provider input while retaining source coordinates and the transform.
- Strip or separately govern metadata that may contain location or device information.
- Use no arbitrary remote URLs.
- Time-box description and OCR calls.
- Bound prompt, image, OCR text, structured output, retries, and total job cost.
- Treat visible text as untrusted data, including prompt-injection-like writing inside an image.
- Do not log images, OCR text, provider request bodies, or signed access URLs.
## 15. Frontend behavior
For an admitted image, show:
- Media indexing status;
- description status;
- OCR mode and status;
- source and parent location;
- refresh/retry action;
- diagnostics;
- generated-description label;
- OCR-derived-text label.
The user can choose:
- “Make this image discoverable” — Media descriptor;
- “Also extract visible text” — source-level OCR override;
- project default for future images: never, automatic, or always.
Automatic OCR is the default system policy, but the UI keeps cost and provenance visible.
## 16. Future audio extension
The same architecture extends without changing lattice ownership:
```plain text
audio file
  ├── generated audio descriptor ──► Media lattice
  └── literal transcription ───────► Text lattice
```
Future types can add:
```go
type AudioLocator struct {
    StartMillis int64
    EndMillis   int64
}
```
Audio is not part of V1 implementation or acceptance.
## 17. Acceptance evidence
- An image descriptor is searchable only through the Media lattice.
- The original image is returned when a Media match is opened.
- The generated descriptor can never appear as a Text citation.
- An OCR result, when present, is stored only in the Text lattice and cites image bounds.
- Auto OCR uses the existing description call’s structured assessment; no separate “should OCR run?” model call occurs.
- `never`, `auto`, and `always` policies produce distinct, testable receipts.
- Duplicate uses of one immutable File version reuse one descriptor and vector.
- Images with invalid signatures, excess pixels, or malformed content fail before provider submission.
- A Media search loads no Text or Structured nodes.
- Deleting source authority removes the Media artifact and its OCR-derived Text projection without affecting unrelated entries.
## Sources
- <mention-page url="https://app.notion.com/p/3acb6410e50281d19635f051bb5ee6ad"/>
- <mention-page url="https://app.notion.com/p/3abb6410e50281df8762c162e9a6eb13"/>
- <mention-page url="https://app.notion.com/p/3abb6410e5028179a844c0af77b21ffe"/>
- [Current Omega Intelligence contracts](https://github.com/gccurtis/taurus-omega/blob/f621e9d7ff1c2429fd0a3f0bee3b13f04d4be927/core/capability/intelligence/intelligence.go)
- [Current OpenRouter adapter](https://github.com/gccurtis/taurus-omega/blob/f621e9d7ff1c2429fd0a3f0bee3b13f04d4be927/core/integration/intelligence/openrouter/openrouter.go)
## Current authority links
- <mention-page url="https://app.notion.com/p/3acb6410e50281bf8f16ec589da555d3"/>
- <mention-page url="https://app.notion.com/p/3acb6410e5028157b9e4e8228237cfb8"/>
- <mention-page url="https://app.notion.com/p/3acb6410e50281dfa3abd6a5ed892917">Model — Media Capability & Descriptor Lattice</mention-page>
- <mention-page url="https://app.notion.com/p/3acb6410e502811cb1d8d52f81f4c432"/>
- <mention-page url="https://app.notion.com/p/3acb6410e50281d19635f051bb5ee6ad"/>

