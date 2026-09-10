import type { Id } from "$representation/data/types/core/id";

/** The one current External classification vocabulary. */
export type FileSubkind =
  | "text"
  | "code"
  | "data"
  | "image"
  | "audio"
  | "video"
  | "unknown";

export type ExternalFileOrigin =
  | { kind: "upload" }
  | {
      kind: "connector";
      connectorId: Id<"connectors">;
      sourceId: string;
    };
