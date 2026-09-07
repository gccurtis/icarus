import { sliceByCoordinates } from "$representation/data/behavior/semantic/encoding";
import type { SemanticTextCitation } from "$representation/data/types/semantic/derived-output";

/** Evidence links use the compact clock precision used throughout the editors. */
export const compactEvidenceSourceTitle = (value: string): string =>
  value.replace(/\b(\d{1,2}:\d{2}):\d{2}(\s+[AP]M)\b/i, "$1$2");

/**
 * Resource names used to be prepended to exact-text projections. Keep those
 * citations readable without presenting navigation metadata as evidence.
 */
export const exactEvidenceText = (citation: SemanticTextCitation): string => {
  if (citation.locators === undefined) return citation.span.text;
  const content = citation.locators.filter(
    (entry) =>
      entry.locator.kind !== "resourceTitle" &&
      entry.from < citation.span.to &&
      citation.span.from < entry.to
  );
  if (content.length === 0) return "";
  const from = Math.max(citation.span.from, Math.min(...content.map((entry) => entry.from)));
  const to = Math.min(citation.span.to, Math.max(...content.map((entry) => entry.to)));
  return sliceByCoordinates(
    citation.span.text,
    citation.source.encoding,
    from - citation.span.from,
    to - citation.span.from
  ).trim();
};
