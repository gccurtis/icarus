import type { InternalJobDefinition } from "#utils/jobs/internalRuntime.js";
import type {
  SlideCapability,
  SlideInternalJobIntent
} from "#capabilities/slide/index.js";

export const createSlideInternalJob = (
  slide: SlideCapability,
  intent: SlideInternalJobIntent
): InternalJobDefinition => {
  switch (intent.type) {
    case "slide.compact":
      return {
        name: "slides.compact",
        queueType: "serial",
        work: () => slide.compact(intent.deckId)
      };
    case "slide.prompt-content.create.compute":
      return {
        name: "slides.prompt-content.create.compute",
        queueType: "concurrent",
        work: () => slide.computePromptCreation(intent.attemptId)
      };
    case "slide.prompt-content.create.settle":
      return {
        name: "slides.prompt-content.create.settle",
        queueType: "serial",
        work: () => slide.settlePromptCreation(intent.attemptId)
      };
    case "slide.prompt-content.refresh.compute":
      return {
        name: "slides.prompt-content.refresh.compute",
        queueType: "concurrent",
        work: () => slide.computePromptRefresh(intent.attemptId)
      };
    case "slide.prompt-content.refresh.settle":
      return {
        name: "slides.prompt-content.refresh.settle",
        queueType: "serial",
        work: () => slide.settlePromptRefresh(intent.attemptId)
      };
  }
};
