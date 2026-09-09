import type { FormatContract } from "$development-views/external-files-reference/types";

/** Claims below are projections of production code on work/external-files. */
export const CURRENT_TRUTHS = [
  {
    area: "Ownership boundary",
    state: "exists",
    contract: "External reads the admitted File, derives SHA-256, byte size, storage id, media type, and file subkind, then delegates an already-complete descriptor to its storage model. The semantic material lane receives only an authorized resource reference and never manages upload bytes.",
    evidence: "external-files/api/shared/native-file.ts"
  },
  {
    area: "Native repository",
    state: "exists",
    contract: "externalFileStorage defensively verifies External's descriptor, atomically publishes a complete content-addressed value, deduplicates it, re-hashes every read, and removes it idempotently. A read-only legacy directory preserves old rows.",
    evidence: "model/server/external-file-storage/{definition,types}.ts"
  },
  {
    area: "Resource record",
    state: "exists",
    contract: "externalFiles owns project identity, current name/path, immutable original upload name, native receipt, classification, optional dataset context, actors, timestamps, and compare-and-swap revision. New fields remain readable alongside legacy rows.",
    evidence: "representation/store/tables.ts + external-files/api/shared/rows.ts"
  },
  {
    area: "Admission",
    state: "exists",
    contract: "Every read and mutation scopes first, strictly admits represented metadata, quarantines malformed rows, normalizes paths, and returns safe actor/origin projections without exposing a filesystem location or accepting browser-authored authority.",
    evidence: "external-files/api/shared/{rows,validation}.ts"
  },
  {
    area: "Ingestion + re-upload",
    state: "exists",
    contract: "Bounded multipart forms ingest files or browser directories with mixed outcomes. Re-upload retains the same externalFile id/name/path, replaces its native receipt, advances revision, retires old semantic output, queues supported new meaning, and reclaims the prior unshared blob.",
    evidence: "external-files/api/{upload-external-files,reupload-external-file}"
  },
  {
    area: "Virtual directories",
    state: "exists",
    contract: "Folders are projected from canonical relative paths. File moves use row revision CAS; directory rename/move uses an opaque descendant-set token, collision preflight, and one atomic externalFiles-table replacement for all descendants.",
    evidence: "external-files/api/{shared/directories,relocate-external-*}"
  },
  {
    area: "Stable library",
    state: "exists",
    contract: "External is a permanent category singleton like Overview and Templates. Its Content surface has Table and Directory views, search/filter/sort, upload receipts, and selection; files and folders never become editor tabs.",
    evidence: "external/content/library.svelte + workspace/{starting,opening}.ts"
  },
  {
    area: "Inspector manager",
    state: "exists",
    contract: "external.file owns top-level Rename, Re-upload, Download, Move, and Delete actions; double-click name/path editing; Details; reference count/list; dataset context; and semantic review only when a material representation can exist. It shows neither hashes nor editor controls.",
    evidence: "external/inspector/{file,directory}.svelte"
  },
  {
    area: "History",
    state: "exists",
    contract: "The History Context view reads durable, project-scoped activity rows for upload, re-upload, rename, move, context update, and deletion. Deleted resources remain visible in history because events do not depend on the current file row.",
    evidence: "external-files/api/{shared/history,read-external-file-history}"
  },
  {
    area: "Semantic delegation",
    state: "exists",
    contract: "External files never enter the exact lane. Plain text and source code share externalFile::code and delegate verified UTF-8 to one bounded code-profile material; datasets use a separate profile and can add authored context. A standalone image delegates its original pixels directly to visual embedding and creates no generated summary. Other families create no semantic job.",
    evidence: "semantic-overlay/api/shared/{resource-ref,material-resource,material-facets}.ts"
  },
  {
    area: "Queue execution",
    state: "partial",
    contract: "Upload, rename, move, context change, and re-upload establish a revision and queue recoverable semantic work without waiting. This branch provides queue processing and backfill seams but no always-on deployment host, and the Inspector deliberately has no manual semantic-refresh control.",
    evidence: "semantic-overlay/api/{enqueue-semantic-sync,backfill-semantic-overlay}"
  },
  {
    area: "Native response",
    state: "exists",
    contract: "A project-authorized route serves verified bytes as an attachment with response bounds, one-range support, SHA-256 ETag, private/no-cache, nosniff, sandbox CSP, and escaped ASCII/UTF-8 filenames.",
    evidence: "routes/app/[project]/external-files/[externalFile]/+server.ts"
  }
] as const;

export const FORMAT_CONTRACTS: readonly FormatContract[] = [
  {
    family: "Plain text + source code",
    examples: ".txt · .md · .xml · .ts · .py · .go · .sql · .json",
    classification: "code",
    content: "Native attachment plus one bounded code-profile material and a generated summary when descriptor processing is enabled",
    exactLane: "Unsupported — textual files are not split into exact spans",
    materialLane: "Eligible — language, line count, code structure when present, and a separately embedded generated descriptor",
    v1: "complete",
    caution: "All text/code shares externalFile::code. Strict UTF-8 decoding happens inside the worker; invalid text fails semantics without invalidating the stored file. The descriptor sees at most a 64,000-byte head/tail excerpt"
  },
  {
    family: "Delimited data",
    examples: ".csv · .tsv",
    classification: "data",
    content: "Native attachment, editable authored dataset context, bounded profile, and optional generated material summary",
    exactLane: "Unsupported",
    materialLane: "Eligible — sampled rows, headers, column types, warnings, and authored context",
    v1: "complete",
    caution: "A dataset can be ambiguous; the Inspector explicitly lets a person add or clear context and then queues a new revision"
  },
  {
    family: "Image",
    examples: ".png · .jpg · .gif · .webp",
    classification: "image from signature or admitted media type",
    content: "Native attachment plus one direct visual representation in the material lane",
    exactLane: "Unsupported",
    materialLane: "Eligible — original pixels are embedded directly",
    v1: "complete",
    caution: "Standalone External images have no text facets or generated semantic summary; External still provides no preview/editor"
  },
  {
    family: "PDF",
    examples: ".pdf",
    classification: "unknown with application/pdf retained",
    content: "Stored manager record and forced attachment download",
    exactLane: "Unsupported",
    materialLane: "Unsupported",
    v1: "stored",
    caution: "The PDF signature is detected, but there is no extraction, preview, OCR, or viewer claim"
  },
  {
    family: "Office / archive",
    examples: ".xlsx · .docx · .pptx · .zip",
    classification: "unknown; sanitized supplied MIME may be retained",
    content: "Stored manager record and forced attachment download",
    exactLane: "Unsupported",
    materialLane: "Unsupported",
    v1: "stored",
    caution: "ZIP signatures are recognized only as a container; members are never expanded or executed"
  },
  {
    family: "Audio / video",
    examples: ".mp3 · .wav · .mp4 · .webm",
    classification: "audio / video from admitted media type",
    content: "Stored manager record and forced attachment download",
    exactLane: "Unsupported",
    materialLane: "Unsupported",
    v1: "stored",
    caution: "There is no playback, waveform, thumbnail, transcription, or generated summary"
  },
  {
    family: "Unknown binary",
    examples: "everything else",
    classification: "unknown",
    content: "Stored manager record and forced attachment download",
    exactLane: "Unsupported",
    materialLane: "Unsupported",
    v1: "stored",
    caution: "Unknown never means rejected solely for format; it means retained without entry into the semantic overlay"
  }
] as const;

export const INGESTION_STEPS = [
  {
    id: "01",
    owner: "External Content view",
    call: "uploadExternalFiles.for(files | folder)",
    input: "multipart File[] plus indexed relativePaths[]",
    output: "one enhanced remote-form submission",
    rule: "Folder paths are copied from webkitRelativePath into real hidden controls aligned by index; setting the remote field programmatically is not sufficient for browser serialization."
  },
  {
    id: "02",
    owner: "External-files capability",
    call: "requireScope → validateUploadExternalFiles",
    input: "untrusted form fields and browser File hints",
    output: "scoped candidates plus configured bounds",
    rule: "The client supplies no project, actor, storage id, hash, subkind, revision, timestamps, or trusted byte size."
  },
  {
    id: "03",
    owner: "External-files capability",
    call: "normalize path → read bounded bytes",
    input: "File.name, File.size, File.type, relative-path hint",
    output: "canonical path and complete bounded Uint8Array",
    rule: "Reject roots, traversal, NUL, empty segments, duplicate canonical paths, oversized UTF-8 paths, declared/received size disagreement, and batch/file ceilings."
  },
  {
    id: "04",
    owner: "External-files capability",
    call: "admitNativeFile(bytes, MIME hint, name)",
    input: "received bytes plus non-authoritative browser hints",
    output: "{ storageId, hash, size, mediaType, subkind }",
    rule: "External calculates SHA-256 and size, checks signatures first, canonicalizes known textual/code and data extensions, and keeps unknown content safely downloadable."
  },
  {
    id: "05",
    owner: "External-file storage model",
    call: "externalFileStorage.put(admitted descriptor + bytes)",
    input: "External-derived descriptor and complete byte value",
    output: "verified { storageId, hash, size, reused } receipt",
    rule: "The repository verifies every descriptor field, atomically renames a complete sibling, deduplicates by hash, and never classifies or authors file metadata."
  },
  {
    id: "06",
    owner: "External-files capability",
    call: "path policy → store.create(externalFiles) → history",
    input: "trusted native receipt, classification, scope, and path",
    output: "new row, idempotently reused row, path conflict, or per-file failure",
    rule: "Same project path plus same hash reuses; different bytes at an occupied path reject and point users to Re-upload. Metadata failure triggers best-effort orphan compensation."
  },
  {
    id: "07",
    owner: "Semantic-overlay capability",
    call: "enqueueSemanticSync(committed ref)",
    input: "externalFile::code (plain text or source), ::data, ::image, or unsupported family",
    output: "one coalesced material job or no job",
    rule: "Only unified text/code, CSV/TSV, and image are eligible. External exact work is impossible. Enqueue failure is reported but never rolls back a usable file."
  },
  {
    id: "08",
    owner: "Workspace + External view",
    call: "refresh projections → inspectExternalFile",
    input: "mixed upload receipt",
    output: "same External singleton with a successful file selected",
    rule: "The receipt stays visible; selection changes focus and Inspector only. Directory mode and folder metadata never create editor tabs or native server directories."
  }
] as const;
