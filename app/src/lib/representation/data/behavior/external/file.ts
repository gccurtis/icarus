import type { FileSubkind } from "$representation/data/types/external/file";

/** Deterministic subkind used by material adapters; callers may override `unknown`. */
export const fileSubkindFor = (mediaType: string, name = ""): FileSubkind => {
  const media = mediaType.toLowerCase();
  const lowerName = name.toLowerCase();
  if (media.startsWith("image/")) return "image";
  if (media.startsWith("audio/")) return "audio";
  if (media.startsWith("video/")) return "video";
  if (
    media.includes("csv") ||
    media.includes("spreadsheet") ||
    /\.(csv|tsv|xls|xlsx)$/.test(lowerName)
  ) return "data";
  if (
    media.startsWith("text/") ||
    media.includes("json") ||
    media.includes("xml") ||
    /\.(txt|md|js|jsx|ts|tsx|py|rb|rs|go|java|c|cc|cpp|h|hpp|css|html|sql)$/.test(lowerName)
  ) return "text";
  return "unknown";
};
