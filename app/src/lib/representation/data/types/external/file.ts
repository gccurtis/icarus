import type { Id } from "$representation/data/types/core/id";

/** Canonical External families exposed by current capability reads. */
export type FileSubkind = "code" | "data" | "image" | "audio" | "video" | "unknown";

/** `text` is accepted only while reading rows written before text/code were unified. */
export type StoredFileSubkind = FileSubkind | "text";

export type ExternalFileOrigin =
  | { kind: "upload" }
  | {
      kind: "connector";
      connectorId: Id<"connectors">;
      sourceId: string;
    };
