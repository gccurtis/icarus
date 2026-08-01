import type { Logger } from "#platform/observability/logger.js";
import type { RichText } from "#rich-text";
import type { BackendConfig } from "#utils/config/loadBackendConfig.js";
import type { InternalJobsRuntime } from "#utils/jobs/internalRuntime.js";
import {
  createSlideCapability,
  DEFAULT_SLIDE_OPTIONS,
  SQLiteSlideStore,
  type SlideCapability,
  type SlideDerivedOutputs,
  type SlideInternalJobIntent
} from "#capabilities/slide/index.js";

const SLIDE_DB_PATH = "./data/slides.db";

/** Constructs one trusted, project-scoped Slide capability instance. */
export const createSlideInstance = (
  config: BackendConfig,
  richText: RichText,
  derivedOutputs: SlideDerivedOutputs,
  jobs: InternalJobsRuntime<SlideInternalJobIntent>,
  logger: Logger
): SlideCapability => {
  const store = new SQLiteSlideStore(config.projectId, SLIDE_DB_PATH);
  return createSlideCapability(store, {
    richText,
    derivedOutputs,
    jobs,
    logger,
    attribution: { actorId: config.userId }
  }, DEFAULT_SLIDE_OPTIONS);
};
