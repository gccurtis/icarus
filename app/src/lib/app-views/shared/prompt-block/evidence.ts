import type { SemanticTextCitation } from "$representation/data/types/semantic/derived-output";

/** Evidence links use the compact clock precision used throughout the editors. */
export const compactEvidenceSourceTitle = (value: string): string =>
  value.replace(/\b(\d{1,2}:\d{2}):\d{2}(\s+[AP]M)\b/i, "$1$2");

/** Exact evidence is already projected content; resource metadata is out of band. */
export const exactEvidenceText = (citation: SemanticTextCitation): string =>
  citation.span.text.trim();
