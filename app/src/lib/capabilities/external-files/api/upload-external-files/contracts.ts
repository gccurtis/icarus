import type { FileSubkind } from "$representation/data/types/external/file";
import type { Id } from "$representation/data/types/core/id";
import type { TableRow } from "$model/server/store/index.server";

export type AdmittedUploadFile = {
  readonly status: "admitted";
  readonly source: File;
  readonly bytes: Uint8Array;
  readonly name: string;
  readonly originalName: string;
  readonly relativePath: string;
  readonly native: {
    readonly storageId: Id<"_storage">;
    readonly hash: string;
    readonly size: number;
    readonly mediaType: string;
    readonly subkind: FileSubkind;
  };
};

export type UploadStoreDecision =
  | { readonly kind: "conflict" }
  | { readonly kind: "reused"; readonly row: TableRow<"externalFiles"> }
  | {
      readonly kind: "created";
      readonly row: TableRow<"externalFiles">;
      readonly semantic: "queued" | "unsupported";
    };

export type UploadSettlementDecision =
  | UploadStoreDecision
  | { readonly kind: "store-failed"; readonly error: unknown };
