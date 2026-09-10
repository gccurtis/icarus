import type { FormatContract } from "$development-views/external-files-reference/types";

/** Projections of the current production code; this suite has no legacy contract. */
export const CURRENT_TRUTHS = [
  {
    area: "Ownership boundary",
    state: "exists",
    contract: "External reads the admitted File and derives SHA-256, actual size, content-addressed storage id, media type, and a distinct current subkind. Semantic workers receive only a committed, project-owned External reference.",
    evidence: "external-files/api/shared/native-file.ts"
  },
  {
    area: "Native repository",
    state: "exists",
    contract: "externalFileStorage is the sole native-I/O owner. It verifies descriptors, publishes immutable bytes with a durable recovery copy, creates one hash-bound claim per represented row, re-hashes reads, and reconciles interrupted publications, quarantines, stale claims, and true orphans after Store recovery.",
    evidence: "model/server/external-file-storage/{definition,types}.ts"
  },
  {
    area: "Strict resource record",
    state: "exists",
    contract: "Every External row has one current schema: project identity, current and original names, canonical relative path, classification, native receipt, origin, actors, timestamps, positive revision, and optional dataset context. Required values are never synthesized.",
    evidence: "representation/data/behavior/external/row.ts"
  },
  {
    area: "Atomic lifecycle",
    state: "exists",
    contract: "Each mutation uses one Store transaction for row create/update/remove, revision and path checks, durable History, semantic forget, and semantic outbox. Directory relocation commits every descendant together. Native claim release and orphan cleanup happen idempotently after commit.",
    evidence: "external-files/api/shared/mutations.ts + api/*"
  },
  {
    area: "Ingestion + re-upload",
    state: "exists",
    contract: "Bounded multipart forms ingest files or browser directories with a result per file. Re-upload preserves External identity and represented references while replacing verified bytes and advancing revision in the same atomic metadata lifecycle.",
    evidence: "external-files/api/{upload-external-files,reupload-external-file}"
  },
  {
    area: "Virtual directories",
    state: "exists",
    contract: "Folders are strict projections of canonical file paths. File moves use row-revision CAS; directory rename/move uses an opaque descendant token, collision preflight, the configured path-byte rule, and one Store transaction for every affected file.",
    evidence: "external-files/api/{shared/directories,relocate-external-*}"
  },
  {
    area: "Reference-safe deletion",
    state: "exists",
    contract: "One typed traversal covers every current representation table and explicitly classifies live references, leaders, historical by-value records, semantic caches, and transient workspace focus. Live use blocks deletion; history and caches do not masquerade as identity-bearing use.",
    evidence: "external/reference-policy.ts + external-files/api/shared/{resource-references,usage}.ts"
  },
  {
    area: "Stable library",
    state: "exists",
    contract: "External is a permanent category singleton like Overview and Templates. Content provides Table and Directory projections, navigation, search, kind/semantic filters, sorting, upload receipts, and selection; selecting a file never creates an editor tab.",
    evidence: "external/content/library.svelte + workspace opening"
  },
  {
    area: "Inspector manager",
    state: "exists",
    contract: "The file Inspector keeps Rename, Re-upload, Download, Move, and Delete together at the top, then shows availability, details, references, optional dataset context, semantic status, and generated descriptions only when one exists. The directory Inspector manages projected subtrees.",
    evidence: "external/inspector/{file,directory}.svelte"
  },
  {
    area: "History",
    state: "exists",
    contract: "History reads the newest 200 durable, project-scoped lifecycle events for upload, re-upload, rename, move, context update, and deletion. Events survive removal of the current file row.",
    evidence: "external-files/api/{shared/history,read-external-file-history}"
  },
  {
    area: "Semantic delegation",
    state: "exists",
    contract: "Plain text and Markdown use the existing exact-text lane. Programming source uses the code/material lane, structured data uses the data/material lane with optional authored context, and images use the native-visual material lane. PDF, Office, audio, video, and unknown bytes remain managed without semantic work.",
    evidence: "semantic-overlay/api/shared/{outbox,resource,material-resource}.ts"
  },
  {
    area: "Native response",
    state: "exists",
    contract: "A project-authorized route serves verified bytes as attachments with a response bound, single-range support, SHA-256 ETag, private/no-cache, nosniff, sandbox CSP, and safe ASCII plus RFC 5987 filenames.",
    evidence: "routes/app/[project]/external-files/[externalFile]/+server.ts"
  }
] as const;

export const FORMAT_CONTRACTS: readonly FormatContract[] = [
  {
    family: "Plain prose",
    examples: ".txt · .md · .markdown · .rst",
    classification: "text",
    content: "Verified native attachment plus one exact, quoteable UTF-8 source",
    exactLane: "Eligible — one source with exact locators and content hash",
    materialLane: "Not used — no generated summary or code profile",
    v1: "complete",
    caution: "Exact-text admission is bounded to 5,000,000 bytes and fails semantic work, not storage, when bytes are invalid UTF-8"
  },
  {
    family: "Programming source",
    examples: ".ts · .py · .go · .rs · .java · .sql · .svelte",
    classification: "code",
    content: "Verified native attachment plus one bounded code-profile material",
    exactLane: "Not used",
    materialLane: "Eligible — language, line count, imports, exports, symbols, warnings, and optional generated description",
    v1: "complete",
    caution: "Source code remains distinct from prose. The descriptor sees a deterministic 64,000-byte head/tail excerpt; invalid UTF-8 fails only material processing"
  },
  {
    family: "Structured data",
    examples: ".csv · .tsv · .json · .jsonl · .yaml · .xml · .toml",
    classification: "data",
    content: "Verified attachment; CSV/TSV receives a bounded profile and optional authored dataset context",
    exactLane: "Not used",
    materialLane: "CSV/TSV eligible — sampled rows, headers, types, warnings, context, and optional generated description",
    v1: "partial",
    caution: "The classification is broader than the implemented material parser. Non-delimited structured formats remain stored when no material seed can be produced"
  },
  {
    family: "Image",
    examples: ".png · .jpg · .gif · .webp",
    classification: "image from byte signature first",
    content: "Verified attachment plus one direct native-visual material representation",
    exactLane: "Not used",
    materialLane: "Eligible — original pixels are embedded directly",
    v1: "complete",
    caution: "Semantic visual input is capped at 5,000,000 bytes. There is no generated text summary, OCR, preview, or image editor"
  },
  {
    family: "PDF",
    examples: ".pdf",
    classification: "unknown with application/pdf",
    content: "Stored manager record and forced attachment download",
    exactLane: "Not used",
    materialLane: "Not used",
    v1: "stored",
    caution: "The PDF byte signature overrides misleading caller MIME, but there is no extraction, preview, OCR, or viewer claim"
  },
  {
    family: "Office / archive",
    examples: ".xlsx · .docx · .pptx · .zip",
    classification: "unknown with detected ZIP/container MIME where applicable",
    content: "Stored manager record and forced attachment download",
    exactLane: "Not used",
    materialLane: "Not used",
    v1: "stored",
    caution: "Container members are never expanded, parsed, or executed"
  },
  {
    family: "Audio / video / unknown",
    examples: ".mp3 · .wav · .mp4 · .webm · arbitrary binary",
    classification: "audio · video · unknown",
    content: "Stored manager record and forced attachment download",
    exactLane: "Not used",
    materialLane: "Not used",
    v1: "stored",
    caution: "There is no playback, transcription, thumbnail, preview, or generated description. Unknown format alone is not a reason to reject"
  }
] as const;

export const INGESTION_STEPS = [
  {
    id: "01",
    owner: "External Content view",
    call: "uploadExternalFiles.for(files | folder)",
    input: "multipart File[] plus indexed relativePaths[]",
    output: "one enhanced remote-form submission",
    rule: "Folder paths are copied from webkitRelativePath into real hidden controls aligned with the File inputs, because browser serialization includes successful DOM controls."
  },
  {
    id: "02",
    owner: "External-files capability",
    call: "requireScope → validateUploadExternalFiles",
    input: "untrusted form fields and File hints",
    output: "project/user scope and configured batch bounds",
    rule: "The caller supplies no project, actor, hash, storage id, subkind, revision, or trusted size."
  },
  {
    id: "03",
    owner: "External-files capability",
    call: "canonical path → bounded byte read",
    input: "name, declared size/type, relative-path hint",
    output: "canonical path and recounted Uint8Array",
    rule: "NFC normalization and one configured UTF-8 path rule reject roots, traversal, empty segments, control characters, duplicates, and oversize paths across every path mutation."
  },
  {
    id: "04",
    owner: "External-files capability",
    call: "admitNativeFile(bytes, MIME hint, name)",
    input: "complete received bytes plus non-authoritative hints",
    output: "{ storageId, hash, size, mediaType, subkind }",
    rule: "External calculates identity and classifies byte signatures before MIME/name hints, keeping prose, code, data, image, audio, video, and unknown distinct."
  },
  {
    id: "05",
    owner: "External-file storage model",
    call: "externalFileStorage.put(descriptor + bytes)",
    input: "External-derived descriptor and complete bytes",
    output: "verified receipt plus durable publication token",
    rule: "The model fsyncs a unique recovery copy, hard-links an immutable canonical hash, and retains the copy until a represented row claims it."
  },
  {
    id: "06",
    owner: "External-files capability",
    call: "Store.transaction(create + history + forget + outbox)",
    input: "trusted receipt, classification, scope, and free path",
    output: "one revision-1 row and its semantic disposition",
    rule: "Path uniqueness is checked inside the same unit of work. The row, durable History, semantic cleanup, and outbox are one commit; a same-path/same-hash row is reused."
  },
  {
    id: "07",
    owner: "External-file storage model",
    call: "claimPublication → cleanup orphan",
    input: "committed row id and publication receipt",
    output: "durable row claim and no stale recovery copy",
    rule: "If the Store outcome is ambiguous, every readable committed row sharing the receipt claims the bytes, a readable rollback discards them, and an unavailable post-commit Store leaves recovery state for startup."
  },
  {
    id: "08",
    owner: "Workspace + External view",
    call: "refresh projections → inspectExternalFile",
    input: "mixed per-file receipt",
    output: "same External singleton with a successful file selected",
    rule: "Each file is independently atomic. Selection changes focus and Inspector only; virtual folders and files never create editor tabs."
  }
] as const;
