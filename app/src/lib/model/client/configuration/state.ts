import type { ClientConfigurationInput } from "$model/client/configuration/types";

/**
 * One client-workspace configuration singleton.
 *
 * The state is deliberately flat and primitive-only. Runtime copies the
 * admitted transport value into these fields, so no mutable object received
 * from the route remains aliased to model state.
 */
export type ConfigurationState = {
  readonly gutterMaximumRem: number;
  readonly gutterMinimumRem: number;
  readonly revisionFlushAfterMs: number;
  readonly revisionFlushAfterOps: number;
  readonly revisionSyncEveryMs: number;
  readonly stageAverageGlyphWidthEm: number;
  readonly stageUnitsHigh: number;
  readonly stageWidthRem: number;
  readonly workspaceFlushAfterMs: number;
  readonly workspaceFlushAfterOps: number;
  readonly zoomMaximum: number;
  readonly zoomMinimum: number;
  readonly zoomStep: number;
};

/** Called once by the client runtime model builder. */
export const createConfigurationState = (
  input: ClientConfigurationInput
): ConfigurationState => ({
  gutterMaximumRem: input.presentation.gutter.maximumRem,
  gutterMinimumRem: input.presentation.gutter.minimumRem,
  revisionFlushAfterMs: input.revisions.changeSets.flushAfterMs,
  revisionFlushAfterOps: input.revisions.changeSets.flushAfterOps,
  revisionSyncEveryMs: input.revisions.sync.everyMs,
  stageAverageGlyphWidthEm: input.presentation.stage.averageGlyphWidthEm,
  stageUnitsHigh: input.presentation.stage.unitsHigh,
  stageWidthRem: input.presentation.stage.widthRem,
  workspaceFlushAfterMs: input.workspace.changeSets.flushAfterMs,
  workspaceFlushAfterOps: input.workspace.changeSets.flushAfterOps,
  zoomMaximum: input.presentation.zoom.maximum,
  zoomMinimum: input.presentation.zoom.minimum,
  zoomStep: input.presentation.zoom.step
});
