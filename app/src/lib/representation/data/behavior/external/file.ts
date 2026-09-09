import type { FileSubkind, StoredFileSubkind } from "$representation/data/types/external/file";

const CODE_EXTENSIONS: Record<string, string> = {
  js: "javascript", jsx: "javascript", mjs: "javascript", cjs: "javascript",
  ts: "typescript", tsx: "typescript", py: "python", rb: "ruby", rs: "rust",
  go: "go", java: "java", c: "c", h: "c", cc: "cpp", cpp: "cpp", hpp: "cpp",
  css: "css", html: "html", sql: "sql", sh: "shell", zsh: "shell",
  json: "json", yaml: "yaml", yml: "yaml", toml: "toml",
  txt: "plain-text", text: "plain-text", md: "markdown", markdown: "markdown",
  xml: "xml"
};

const CODE_MEDIA_TYPES: Record<string, string> = {
  "application/javascript": "javascript",
  "application/x-javascript": "javascript",
  "text/javascript": "javascript",
  "application/typescript": "typescript",
  "text/typescript": "typescript",
  "application/json": "json",
  "application/ld+json": "json",
  "text/plain": "plain-text",
  "text/markdown": "markdown",
  "text/xml": "xml",
  "application/xml": "xml",
  "application/sql": "sql",
  "text/css": "css",
  "text/html": "html",
  "text/x-python": "python",
  "text/x-ruby": "ruby",
  "text/x-rust": "rust",
  "text/x-go": "go",
  "text/x-java-source": "java",
  "application/x-sh": "shell",
  "text/x-shellscript": "shell"
};

/** External owns format-family detection; semantic code profiling consumes it. */
export const externalCodeLanguage = (name: string, mediaType = ""): string => {
  const extension = name.toLowerCase().split(".").at(-1) ?? "";
  if (CODE_EXTENSIONS[extension] !== undefined) return CODE_EXTENSIONS[extension];
  const media = mediaType.toLowerCase().split(";", 1)[0]?.trim() ?? "";
  return CODE_MEDIA_TYPES[media] ?? (
    media.startsWith("text/")
      ? "plain-text"
      : media.endsWith("+xml")
        ? "xml"
        : "unknown"
  );
};

/** Deterministic subkind used by material adapters; callers may override `unknown`. */
export const fileSubkindFor = (mediaType: string, name = ""): FileSubkind => {
  const media = mediaType.toLowerCase();
  const lowerName = name.toLowerCase();
  if (media.startsWith("image/")) return "image";
  if (media.startsWith("audio/")) return "audio";
  if (media.startsWith("video/")) return "video";
  if (media.includes("csv") || media.includes("tab-separated") || /\.(csv|tsv)$/.test(lowerName)) {
    return "data";
  }
  if (externalCodeLanguage(name, mediaType) !== "unknown") return "code";
  return "unknown";
};

/** Canonicalizes the retired `text` family without rewriting persisted rows. */
export const canonicalFileSubkind = (
  held: StoredFileSubkind | undefined,
  mediaType: string,
  name: string
): FileSubkind => {
  const inferred = fileSubkindFor(mediaType, name);
  if (held === undefined) return inferred;
  if (held === "text") return inferred === "unknown" ? "code" : inferred;
  return held;
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

/** Empty string is the virtual External root and never a native filesystem path. */
export const normalizeExternalDirectoryPath = (value: string): string => {
  if (value === "") return "";
  const normalized = normalizeExternalRelativePath(value);
  if (normalized.endsWith("/")) throw new Error("an external directory path has no trailing slash");
  return normalized;
};

export const externalDirectoryIn = (relativePath: string): string => {
  const segments = normalizeExternalRelativePath(relativePath).split("/");
  return segments.length === 1 ? "" : segments.slice(0, -1).join("/");
};

export const externalDirectoryNameIn = (path: string): string => {
  const normalized = normalizeExternalDirectoryPath(path);
  return normalized === "" ? "External" : normalized.split("/").at(-1)!;
};

export const externalDirectoryParentIn = (path: string): string | null => {
  const normalized = normalizeExternalDirectoryPath(path);
  if (normalized === "") return null;
  const segments = normalized.split("/");
  return segments.length === 1 ? "" : segments.slice(0, -1).join("/");
};

export const externalPathIn = (directory: string, name: string): string => {
  const normalized = normalizeExternalDirectoryPath(directory);
  return normalizeExternalRelativePath(normalized === "" ? name : `${normalized}/${name}`);
};

export const externalDirectoryContains = (directory: string, relativePath: string): boolean => {
  const normalized = normalizeExternalDirectoryPath(directory);
  const path = normalizeExternalRelativePath(relativePath);
  return normalized === "" || path.startsWith(`${normalized}/`);
};

/** A small signature reconciler; unknown types stay safely downloadable. */
export const mediaTypeForExternalBytes = (
  bytes: Uint8Array,
  declared: string,
  name: string
): string => {
  const starts = (...values: number[]): boolean =>
    values.every((value, index) => bytes[index] === value);
  const candidate = declared.trim().toLowerCase().split(";", 1)[0] ?? "";
  const supplied = /^[a-z0-9][a-z0-9!#$&^_.+~-]*\/[a-z0-9][a-z0-9!#$&^_.+~-]*$/.test(candidate)
    ? candidate
    : "";
  if (starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  if (starts(0xff, 0xd8, 0xff)) return "image/jpeg";
  if (starts(0x47, 0x49, 0x46, 0x38)) return "image/gif";
  if (
    starts(0x52, 0x49, 0x46, 0x46) &&
    bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50
  ) return "image/webp";
  if (starts(0x25, 0x50, 0x44, 0x46, 0x2d)) return "application/pdf";
  if (starts(0x50, 0x4b, 0x03, 0x04)) {
    return supplied || "application/zip";
  }
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
  if (supplied && supplied !== "application/octet-stream") return supplied;
  return "application/octet-stream";
};
