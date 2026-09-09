import type { FormatContract } from "$development-views/external-files-reference/types";

/** Claims below are projections of production code on work/external-files. */
export const CURRENT_TRUTHS = [
  {
    area: "Native bytes",
    state: "exists",
    contract: "materialContent.put hashes bounded bytes, publishes a complete sibling atomically, deduplicates by SHA-256, and returns a verified receipt. Reads re-hash; remove is idempotent.",
    evidence: "model/server/material-content/{definition,types}.ts"
  },
  {
    area: "Resource record",
    state: "exists",
    contract: "externalFiles owns project identity, mutable local name, immutable original name/path/hash/storage receipt, actual size, origin, actors, revision, and update time. New fields remain optional for old rows.",
    evidence: "representation/store/tables.ts"
  },
  {
    area: "Admission",
    state: "exists",
    contract: "The External capability scopes before reading, strictly admits each row, quarantines corrupt metadata, resolves safe actor/origin labels, and never returns internal filesystem paths.",
    evidence: "capabilities/external-files/api/shared/rows.ts"
  },
  {
    area: "Ingestion",
    state: "exists",
    contract: "Two multipart remote forms accept files or a browser directory, enforce count/byte/path limits, return mixed outcomes, preserve normalized relative paths, and compensate for unclaimed blobs best-effort.",
    evidence: "external/content/library.svelte + upload-external-files.ts"
  },
  {
    area: "Stable library",
    state: "exists",
    contract: "External is a permanent category singleton like Overview and Templates. Search, filters, sorting, upload receipts, context views, and selection live in the one library—not in per-file tabs.",
    evidence: "workspace/starting.ts + app-views/categories/external"
  },
  {
    area: "File manager",
    state: "exists",
    contract: "external.file Inspector owns local rename, attachment download, confirmed reference-safe deletion, provenance, native integrity, usage, semantic status, deterministic profiles, generated summaries, and manual refresh.",
    evidence: "external/inspector/file.svelte"
  },
  {
    area: "Semantic overlay",
    state: "exists",
    contract: "Text can queue exact spans; recognized code, CSV/TSV, and images can independently queue material profiles and generated descriptions. Unsupported types create no failing job. Status and retirement are public capability seams.",
    evidence: "semantic-overlay/{enqueue,status,retire} procedures"
  },
  {
    area: "Queue execution",
    state: "partial",
    contract: "Upload and rename enqueue durable/coalesced jobs without waiting. This branch has no always-on worker: the Inspector Refresh action invokes bounded processing inline; queued work otherwise awaits an external host.",
    evidence: "external/procedures/library.svelte.ts"
  }
] as const;

export const FORMAT_CONTRACTS: readonly FormatContract[] = [
  {
    family: "Plain text",
    examples: ".txt · .md · text/*",
    classification: "text",
    content: "Native attachment plus metadata and semantic state in the file Inspector",
    exactLane: "Eligible — strict UTF-8, 5 MB worker ceiling",
    materialLane: "Unsupported unless codeLanguage recognizes the file",
    v1: "complete",
    caution: "Upload is valid before the exact worker runs; invalid UTF-8 fails the lane, not the file"
  },
  {
    family: "Recognized source code",
    examples: ".ts · .py · .go · .sql",
    classification: "text for the built-in extension set",
    content: "Native attachment, exact status, code profile, and optional generated description",
    exactLane: "Eligible when classified text",
    materialLane: "Eligible — language, imports, symbols, line profile",
    v1: "complete",
    caution: "The file classifier and codeLanguage have distinct extension sets; unsupported mismatches remain honestly managed-only"
  },
  {
    family: "Delimited data",
    examples: ".csv · .tsv",
    classification: "data",
    content: "Native attachment, sampled schema/profile, and optional generated description",
    exactLane: "Unsupported",
    materialLane: "Eligible — bounded CSV/TSV profile",
    v1: "complete",
    caution: "The semantic parser—not upload—enforces row, column, and cell sampling bounds"
  },
  {
    family: "Image",
    examples: ".png · .jpg · .gif · .webp",
    classification: "image when signature or media type supports it",
    content: "Native attachment, deterministic image facets, optional generated description",
    exactLane: "Unsupported",
    materialLane: "Eligible — native pixels included only at or below 5 MB",
    v1: "complete",
    caution: "There is deliberately no inline preview or image editor in External"
  },
  {
    family: "PDF",
    examples: ".pdf",
    classification: "unknown with application/pdf retained",
    content: "Managed metadata and forced attachment download",
    exactLane: "Unsupported",
    materialLane: "Unsupported",
    v1: "stored",
    caution: "PDF signature is sniffed, but no text extraction or viewer is claimed"
  },
  {
    family: "Office / archives",
    examples: ".xlsx · .docx · .zip",
    classification: "data for spreadsheet extensions; otherwise unknown",
    content: "Managed metadata and forced attachment download",
    exactLane: "Unsupported",
    materialLane: "Unsupported unless the bytes are actual CSV/TSV or recognized code/image",
    v1: "stored",
    caution: "ZIP signature retains a supplied media type; it does not inspect container members"
  },
  {
    family: "Audio / video",
    examples: ".mp3 · .wav · .mp4 · .webm",
    classification: "audio / video from admitted media type",
    content: "Managed metadata and forced attachment download",
    exactLane: "Unsupported",
    materialLane: "Unsupported",
    v1: "stored",
    caution: "No playback surface or transcription is implemented"
  },
  {
    family: "Unknown binary",
    examples: "everything else",
    classification: "unknown",
    content: "Managed metadata and forced attachment download",
    exactLane: "Unsupported",
    materialLane: "Unsupported",
    v1: "stored",
    caution: "All content is attachment-only with nosniff and sandbox CSP"
  }
] as const;

export const INGESTION_STEPS = [
  {
    id: "01",
    owner: "External content view",
    call: "uploadExternalFiles.for(files | folder)",
    input: "multipart File[] plus parallel relativePaths[]",
    output: "one remote-form submission",
    rule: "webkitRelativePath is copied before submit. Directory structure is metadata; there is no directory row or server path traversal."
  },
  {
    id: "02",
    owner: "External-files capability",
    call: "requireScope → validateUploadExternalFiles",
    input: "untrusted form fields",
    output: "scoped File objects and server configuration",
    rule: "The client supplies no project, actor, storage ID, hash, subkind, revision, or update time."
  },
  {
    id: "03",
    owner: "Representation behavior",
    call: "normalizeExternalRelativePath + mediaTypeForExternalBytes",
    input: "name/path, declared size/type, received bytes",
    output: "canonical NFC path, local name, media type, subkind",
    rule: "Reject absolute roots, drive roots, NUL, dot/empty segments, duplicates, and oversized UTF-8 paths; sniff PNG/JPEG/GIF/PDF/ZIP signatures before extension fallback."
  },
  {
    id: "04",
    owner: "materialContent model",
    call: "put({ bytes, maxBytes })",
    input: "fully buffered, bounded Uint8Array",
    output: "{ storageId, hash, size, reused }",
    rule: "SHA-256 names the blob. A complete temporary sibling is atomically renamed, and an existing hash is re-read and verified."
  },
  {
    id: "05",
    owner: "External-files capability",
    call: "path retry check → store.create(externalFiles)",
    input: "trusted classification and native receipt",
    output: "new row, reused row, conflict, or per-file failure",
    rule: "Same project path + same hash is idempotent reuse; same path + different hash is rejected. Distinct paths may share the blob."
  },
  {
    id: "06",
    owner: "Semantic-overlay capability",
    call: "enqueueSemanticSync",
    input: "committed externalFile::<subkind> reference",
    output: "zero, one, or two coalesced lane jobs",
    rule: "Exact and material eligibility are independent. Enqueue errors are returned on the receipt and never roll back a valid file."
  },
  {
    id: "07",
    owner: "Workspace + External view",
    call: "refresh queries → inspectExternalFile",
    input: "successful upload/reuse outcome",
    output: "External singleton focused on the file Inspector",
    rule: "The upload result becomes the latest visible receipt; selection changes focus and Inspector only—never tab identity."
  }
] as const;
