import type { Id } from "$representation/data/types/core/id";
import type { ExternalFileSubkind } from "$representation/data/types/core/resource";

export type FileSubkind = ExternalFileSubkind;

export type ExternalFileOrigin =
  | { kind: "upload" }
  | {
      kind: "connector";
      connectorId: Id<"connectors">;
      sourceId: string;
    };
