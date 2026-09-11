import type { ConfigurationState } from "$model/client/configuration/state";
import type { ConfigurationNumberKey } from "$model/client/configuration/types";

/** Maps the closed public vocabulary to the model's stored fields. */
export const selectNumber = (
  state: ConfigurationState,
  key: ConfigurationNumberKey
): number => {
  switch (key) {
    case "presentation.gutter.maximumRem":
      return state.gutterMaximumRem;
    case "presentation.gutter.minimumRem":
      return state.gutterMinimumRem;
    case "presentation.stage.averageGlyphWidthEm":
      return state.stageAverageGlyphWidthEm;
    case "presentation.stage.unitsHigh":
      return state.stageUnitsHigh;
    case "presentation.stage.widthRem":
      return state.stageWidthRem;
    case "presentation.zoom.maximum":
      return state.zoomMaximum;
    case "presentation.zoom.minimum":
      return state.zoomMinimum;
    case "presentation.zoom.step":
      return state.zoomStep;
    case "revisions.changeSets.flushAfterMs":
      return state.revisionFlushAfterMs;
    case "revisions.changeSets.flushAfterOps":
      return state.revisionFlushAfterOps;
    case "revisions.sync.everyMs":
      return state.revisionSyncEveryMs;
    case "workspace.changeSets.flushAfterMs":
      return state.workspaceFlushAfterMs;
    case "workspace.changeSets.flushAfterOps":
      return state.workspaceFlushAfterOps;
    default:
      throw new Error(`Unsupported client configuration key: ${key}`);
  }
};
