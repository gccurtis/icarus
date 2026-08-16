import { v, type Infer } from "convex/values";

/**
 * What a file is, for routing: a data file can back an analysis, an image can go
 * in a block, a document gets text read out of it, an unknown file is stored and
 * handed back and nothing else.
 *
 * **The `ext-` prefix is not decoration.** A kind travels into resource sets,
 * lattice sources, and comment anchors, where it is matched against kinds from
 * every other domain — `ext-document` is an uploaded PDF, `document` is an Icarus
 * document, and a bare `document` in both vocabularies would eventually be
 * switched on as if the two were one thing.
 */
export const fileKindValidator = v.union(
  v.literal("ext-text"),
  v.literal("ext-image"),
  v.literal("ext-data"),
  v.literal("ext-document"),
  v.literal("ext-audio"),
  v.literal("ext-video"),
  v.literal("ext-archive"),
  v.literal("ext-unknown")
);

export type FileKind = Infer<typeof fileKindValidator>;

/** The whole classifier: the obvious mapping, and nothing cleverer. */
const KIND_BY_EXTENSION: Readonly<Record<string, FileKind>> = {
  txt: "ext-text",
  md: "ext-text",
  rtf: "ext-text",
  png: "ext-image",
  jpg: "ext-image",
  jpeg: "ext-image",
  gif: "ext-image",
  webp: "ext-image",
  svg: "ext-image",
  heic: "ext-image",
  csv: "ext-data",
  tsv: "ext-data",
  json: "ext-data",
  xlsx: "ext-data",
  xls: "ext-data",
  parquet: "ext-data",
  pdf: "ext-document",
  docx: "ext-document",
  pptx: "ext-document",
  odt: "ext-document",
  mp3: "ext-audio",
  wav: "ext-audio",
  m4a: "ext-audio",
  flac: "ext-audio",
  mp4: "ext-video",
  mov: "ext-video",
  webm: "ext-video",
  avi: "ext-video",
  zip: "ext-archive",
  tar: "ext-archive",
  gz: "ext-archive",
  "7z": "ext-archive"
};

/**
 * The extension as stored: lowercase, no dot, and read off the name rather than
 * accepted beside it, so the two cannot disagree about what the file is.
 *
 * The last segment wins, so `logs.tar.gz` is an archive.
 */
export const extensionOf = (name: string): string => {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
};

/**
 * **An unknown extension is `ext-unknown`, never a refusal.** A file we cannot
 * classify is still a perfectly good file — it just has nothing queued after it
 * is stored.
 *
 * A routing decision, not a claim about the contents: `mimeType` and the bytes
 * remain the authority.
 */
export const kindForExtension = (extension: string): FileKind =>
  KIND_BY_EXTENSION[extension.toLowerCase()] ?? "ext-unknown";
