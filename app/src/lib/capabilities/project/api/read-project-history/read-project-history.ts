import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";

import { activityIn } from "$capabilities/project/api/shared/projection";
import { validateReadProjectHistory } from "$capabilities/project/api/read-project-history/validate-read-project-history";
import type { ReadProjectHistoryResult } from "$capabilities/project/types/project";

/** A neutral project record: activity only, never comments addressed to a person. */
export const readProjectHistory = async (input: unknown): Promise<ReadProjectHistoryResult> => {
  const scope = await requireScope();
  const asked = validateReadProjectHistory(input);

  const windowed = activityIn(serverModel().store, scope).filter(
    (entry) =>
      (asked.since === null || entry.at >= asked.since) &&
      (asked.before === null || entry.at < asked.before)
  );
  const needle = asked.search.toLocaleLowerCase();
  const matching =
    needle.length === 0
      ? windowed
      : windowed.filter((entry) =>
          [
            entry.actorLabel,
            entry.verb,
            entry.target.label,
            entry.context?.label ?? "",
            entry.detail ?? ""
          ]
            .join(" ")
            .toLocaleLowerCase()
            .includes(needle)
        );

  return {
    entries: matching.slice(0, asked.limit),
    matched: matching.length,
    total: windowed.length,
    hasMore: matching.length > asked.limit
  };
};
