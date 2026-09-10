import { requireScope } from "$runtime/server/scope.server";
import { serverModel } from "$runtime/server/start.server";
import type { Id } from "$representation/data/types/core/id";
import type { RefreshDerivedOutputResult } from "$capabilities/derived-output/types/refresh-derived-output";
import { performDerivedOutputRefresh } from "$capabilities/derived-output/api/refresh-derived-output/perform-refresh";
import { validateRefreshDerivedOutput } from "$capabilities/derived-output/api/refresh-derived-output/validate-refresh-derived-output";
import {
  enqueueDerivedOutputRefreshFor,
  processDerivedOutputRefreshFor
} from "$capabilities/derived-output/api/shared/refresh-queue";
import { outputOf } from "$capabilities/derived-output/api/shared/rows";

export const refreshDerivedOutput = async (
  input: unknown
): Promise<RefreshDerivedOutputResult> => {
  const scope = await requireScope();
  const asked = validateRefreshDerivedOutput(input);
  const model = serverModel();
  const projectId = scope.projectId as Id<"projects">;
  if (outputOf(model.store, projectId, asked.derivedOutputId) === undefined) return null;

  enqueueDerivedOutputRefreshFor(model, projectId, asked.derivedOutputId, asked.selection);
  return processDerivedOutputRefreshFor(
    model,
    projectId,
    asked.derivedOutputId,
    async (selection, signal) =>
      await performDerivedOutputRefresh(
        model,
        projectId,
        {
          derivedOutputId: asked.derivedOutputId,
          ...(selection === undefined ? {} : { selection })
        },
        signal
      )
  );
};
