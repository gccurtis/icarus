import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";

import { externalFilesLimits } from "$capabilities/external-files/api/shared/configuration";
import {
  admitUploadFile,
  rejectInvalidBatch
} from "$capabilities/external-files/api/upload-external-files/admission";
import {
  summarizeUploadOutcomes
} from "$capabilities/external-files/api/upload-external-files/outcomes";
import { publishUploadFile } from "$capabilities/external-files/api/upload-external-files/publication";
import { validateUploadExternalFiles } from "$capabilities/external-files/api/upload-external-files/validate-upload-external-files";
import type { UploadExternalFilesResult } from "$capabilities/external-files/types/upload";

/** Admits each file independently, then publishes each accepted intent atomically. */
export const uploadExternalFiles = async (input: unknown): Promise<UploadExternalFilesResult> => {
  const scope = await requireScope();
  const request = validateUploadExternalFiles(input);
  const model = serverModel();
  const limits = externalFilesLimits(model.configuration);
  const invalidBatch = rejectInvalidBatch(request, limits);
  if (invalidBatch !== undefined) return summarizeUploadOutcomes(invalidBatch);

  const outcomes = [];
  const seenPaths = new Set<string>();
  for (let index = 0; index < request.files.length; index += 1) {
    const admitted = await admitUploadFile(
      request.files[index],
      request.relativePaths?.[index],
      seenPaths,
      limits
    );
    outcomes.push(
      admitted.status === "rejected"
        ? admitted
        : await publishUploadFile(model, scope, limits, admitted)
    );
  }
  return summarizeUploadOutcomes(outcomes);
};
