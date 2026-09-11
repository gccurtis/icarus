import { PresentationRuntimes } from "$model/client/presentation-runtimes/definition.svelte";
import type {
  FlushThresholds,
  PresentationRuntimesModel,
  StageSettings
} from "$model/client/presentation-runtimes/types";

export const createPresentationRuntimes = (
  thresholds: FlushThresholds,
  stage: StageSettings
): PresentationRuntimesModel => new PresentationRuntimes(thresholds, stage);
