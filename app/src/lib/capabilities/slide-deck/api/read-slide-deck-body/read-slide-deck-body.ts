import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import { asId } from "$representation/data/behavior/core/id";

import { leaderOf } from "$capabilities/slide-deck/api/shared/leader";
import { validateReadSlideDeckBody } from "$capabilities/slide-deck/api/read-slide-deck-body/validate-read-slide-deck-body";
import type { ReadSlideDeckBodyResult } from "$capabilities/slide-deck/types/read-slide-deck-body";

export const readSlideDeckBody = async (input: unknown): Promise<ReadSlideDeckBodyResult> => {
  const scope = await requireScope();
  const asked = validateReadSlideDeckBody(input);

  const leader = leaderOf(
    serverModel().store,
    asId(scope.projectId),
    asId(asked.resourceId)
  );

  return leader === undefined ? null : { revision: leader.revision, body: leader.body };
};
