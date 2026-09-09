import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";

import { activityIn } from "$capabilities/project/api/shared/projection";
import { validateReadProjectActivity } from "$capabilities/project/api/read-project-activity/validate-read-project-activity";
import type { ReadProjectActivityResult } from "$capabilities/project/types/project";

/** One immutable event, with no inferred or neighbouring history. */
export const readProjectActivity = async (input: unknown): Promise<ReadProjectActivityResult> => {
  const scope = await requireScope();
  const asked = validateReadProjectActivity(input);

  return activityIn(serverModel().store, scope).find(
    (entry) => entry.id === asked.activityId
  ) ?? null;
};
