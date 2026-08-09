import type { InternalJobsRegistrar } from "#utils/jobs/internalRuntime.js";
import type { SlideInternalJobIntent, SlidesCapability } from "#slides";
import { createSlidesInternalJob } from "./createSlidesJobs.js";

/**
 * The formula types exist in the union already, but registering a handler that
 * throws would turn a missing feature into a runtime error on a queue; leaving
 * them unregistered means the scheduler refuses the dispatch at admission.
 */
const TYPES: SlideInternalJobIntent["type"][] = [
  "slides.compact",
  "slides.prompt.create.compute",
  "slides.prompt.create.settle",
  "slides.prompt.refresh.compute",
  "slides.prompt.refresh.settle"
];

export const registerSlidesInternalJobs = (
  jobs: InternalJobsRegistrar<SlideInternalJobIntent>,
  slides: SlidesCapability
): void => {
  for (const type of TYPES) {
    jobs.register(type, (intent) => createSlidesInternalJob(slides, intent));
  }
};
