import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import type { Id } from "$representation/data/types/core/id";

import { leaderOf } from "$capabilities/document/api/shared/leader";
import { validateReadDocumentBody } from "$capabilities/document/api/read-document-body/validate-read-document-body";
import type { ReadDocumentBodyResult } from "$capabilities/document/types/read-document-body";

export const readDocumentBody = async (input: unknown): Promise<ReadDocumentBodyResult> => {
  const scope = await requireScope();
  const asked = validateReadDocumentBody(input);

  const leader = leaderOf(
    serverModel().store,
    scope.projectId as Id<"projects">,
    asked.resourceId as Id<"documents">
  );

  return leader === undefined ? null : { revision: leader.revision, body: leader.body };
};
