import type { Scope, ServerModel } from "$runtime/server/start.server";

import type {
  AdmittedUploadFile,
  UploadSettlementDecision
} from "$capabilities/external-files/api/upload-external-files/contracts";
import {
  failureDetail,
  rejectUpload
} from "$capabilities/external-files/api/upload-external-files/outcomes";
import { settleUploadPublication } from "$capabilities/external-files/api/upload-external-files/settlement";
import { commitUploadFile } from "$capabilities/external-files/api/upload-external-files/transaction";
import type { ExternalFilesLimits } from "$capabilities/external-files/types/shared";
import type { UploadExternalFileOutcome } from "$capabilities/external-files/types/upload";

export const publishUploadFile = async (
  model: ServerModel,
  scope: Scope,
  limits: ExternalFilesLimits,
  file: AdmittedUploadFile
): Promise<UploadExternalFileOutcome> => {
  const release = await model.externalFileStorage.acquireMutation();
  try {
    let receipt;
    try {
      receipt = await model.externalFileStorage.put({
        storageId: file.native.storageId,
        hash: file.native.hash,
        size: file.native.size,
        bytes: file.bytes,
        maxBytes: limits.maxFileBytes
      });
    } catch (error) {
      return rejectUpload(
        file.source,
        "storage-failed",
        failureDetail(error),
        file.relativePath
      );
    }

    let decision: UploadSettlementDecision;
    try {
      decision = commitUploadFile(model, scope, limits, file, receipt);
    } catch (error) {
      decision = { kind: "store-failed", error };
    }
    return await settleUploadPublication(model, file, receipt, decision);
  } finally {
    release();
  }
};
