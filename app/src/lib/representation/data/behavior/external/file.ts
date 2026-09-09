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

/** A browser folder selection becomes safe metadata, never a server filesystem path. */
export const normalizeExternalRelativePath = (value: string): string => {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("an external file path is required");
  }
  if (value.includes("\u0000")) throw new Error("an external file path cannot contain NUL");
  const normalized = value.normalize("NFC").replaceAll("\\", "/");
  if (normalized.startsWith("/") || /^[a-z]:\//i.test(normalized)) {
    throw new Error("an external file path must be relative");
  }
  const segments = normalized.split("/");
  if (segments.some((segment) => segment === "" || segment === "." || segment === "..")) {
    throw new Error("an external file path cannot contain empty or traversal segments");
  }
  if (new TextEncoder().encode(normalized).byteLength > 512) {
    throw new Error("an external file path exceeds 512 UTF-8 bytes");
  }
  return normalized;
};

export const externalFileNameIn = (relativePath: string): string => {
  const name = relativePath.split("/").at(-1);
  if (name === undefined || name.length === 0) throw new Error("an external file name is required");
  return name;
};

/** A small signature reconciler; unknown types stay safely downloadable. */
export const mediaTypeForExternalBytes = (
  bytes: Uint8Array,
  declared: string,
  name: string
): string => {
  const starts = (...values: number[]): boolean =>
    values.every((value, index) => bytes[index] === value);
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (starts(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (starts(0x47, 0x49, 0x46, 0x38)) return "image/gif";
  if (starts(0x25, 0x50, 0x44, 0x46, 0x2d)) return "application/pdf";
  if (starts(0x50, 0x4b, 0x03, 0x04)) {
    return declared.trim().toLowerCase() || "application/zip";
  }
  const candidate = declared.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  const supplied = /^[a-z0-9][a-z0-9!#$&^_.+~-]*\/[a-z0-9][a-z0-9!#$&^_.+~-]*$/.test(candidate)
    ? candidate
    : "";
  if (supplied && supplied !== "application/octet-stream") return supplied;
  const lower = name.toLowerCase();
  if (/\.csv$/.test(lower)) return "text/csv";
  if (/\.tsv$/.test(lower)) return "text/tab-separated-values";
  if (/\.json$/.test(lower)) return "application/json";
  if (/\.md$/.test(lower)) return "text/markdown";
  if (/\.tsx?$/.test(lower)) return "text/typescript";
  if (/\.jsx?$/.test(lower)) return "text/javascript";
  if (/\.(txt|py|rb|rs|go|java|c|cc|cpp|h|hpp|css|html|sql)$/.test(lower)) {
    return "text/plain";
  }
  return "application/octet-stream";
};
