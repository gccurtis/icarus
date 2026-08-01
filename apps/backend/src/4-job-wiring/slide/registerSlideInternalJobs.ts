import type { InternalJobsRegistrar } from "#utils/jobs/internalRuntime.js";
import type {
  SlideCapability,
  SlideInternalJobIntent
} from "#capabilities/slide/index.js";
import { createSlideInternalJob } from "./createSlideJobs.js";

const TYPES: SlideInternalJobIntent["type"][] = [
  "slide.compact",
  "slide.prompt-content.create.compute",
  "slide.prompt-content.create.settle",
  "slide.prompt-content.refresh.compute",
  "slide.prompt-content.refresh.settle"
];

export const registerSlideInternalJobs = (
  jobs: InternalJobsRegistrar<SlideInternalJobIntent>,
  slide: SlideCapability
): void => {
  for (const type of TYPES) {
    jobs.register(type, (intent) => createSlideInternalJob(slide, intent));
  }
};
