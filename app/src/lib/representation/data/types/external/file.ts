import type { Id } from "$representation/data/types/core/id";

export type FileSubkind = "text" | "data" | "image" | "audio" | "video" | "unknown";

export type ExternalFileOrigin =
  | { kind: "upload" }
  | {
      kind: "connector";
      connectorId: Id<"connectors">;
      sourceId: string;
    };
