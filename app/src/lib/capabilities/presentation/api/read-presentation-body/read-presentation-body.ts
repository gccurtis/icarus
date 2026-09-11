import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import { asId } from "$representation/data/behavior/core/id";

import { leaderOf } from "$capabilities/presentation/api/shared/leader";
import { validateReadPresentationBody } from "$capabilities/presentation/api/read-presentation-body/validate-read-presentation-body";
import type { ReadPresentationBodyResult } from "$capabilities/presentation/types/read-presentation-body";

export const readPresentationBody = async (input: unknown): Promise<ReadPresentationBodyResult> => {
  const scope = await requireScope();
  const asked = validateReadPresentationBody(input);

  const leader = leaderOf(
    serverModel().store,
    asId(scope.projectId),
    asId(asked.resourceId)
  );

  return leader === undefined ? null : { revision: leader.revision, body: leader.body };
};
