import type { ServerModel } from "$runtime/server/start.server";

import {
  claimExternalPublication,
  cleanupExternalBlobIfUnreferenced,
  discardExternalPublication,
  settleExternalPublicationAfterStoreFailure
} from "$capabilities/external-files/api/shared/native-file";
import type {
  AdmittedUploadFile,
  UploadSettlementDecision
} from "$capabilities/external-files/api/upload-external-files/contracts";
import {
  failureDetail,
  rejectUpload,
  uploadedOutcome
} from "$capabilities/external-files/api/upload-external-files/outcomes";
import type { UploadExternalFileOutcome } from "$capabilities/external-files/types/upload";
import type { ExternalFileStorageReceipt } from "$model/server/external-file-storage/index.server";

/** Finalizes one represented Store decision against its native publication. */
export const settleUploadPublication = async (
  model: ServerModel,
  file: AdmittedUploadFile,
  receipt: ExternalFileStorageReceipt,
  decision: UploadSettlementDecision
): Promise<UploadExternalFileOutcome> => {
  try {
    if (decision.kind === "store-failed") throw decision.error;
    if (decision.kind === "conflict") {
      await discardExternalPublication(model, receipt);
      await cleanupExternalBlobIfUnreferenced(model, receipt);
      return rejectUpload(
        file.source,
        "path-conflict",
        "That relative path already names a different file in this project. Select it and use Re-upload to replace its contents without changing its identity.",
        file.relativePath
      );
    }

    await claimExternalPublication(model, receipt, decision.row._id);
    const semantic = decision.kind === "created"
      ? decision.semantic
      : decision.row.subkind === "audio" ||
          decision.row.subkind === "video" ||
          decision.row.subkind === "unknown"
        ? "unsupported"
        : "queued";
    return uploadedOutcome(
      decision.kind === "created" ? "uploaded" : "reused",
      decision.row,
      semantic
    );
  } catch (error) {
    await settleExternalPublicationAfterStoreFailure(model, receipt);
    return rejectUpload(file.source, "store-failed", failureDetail(error), file.relativePath);
  }
};
