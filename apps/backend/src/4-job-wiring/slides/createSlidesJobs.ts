import type { InternalJobDefinition } from "#utils/jobs/internalRuntime.js";
import type { SlideInternalJobIntent, SlidesCapability } from "#slides";

export const createSlidesInternalJob = (
  slides: SlidesCapability,
  intent: SlideInternalJobIntent
): InternalJobDefinition => {
  switch (intent.type) {
    case "slides.compact":
      return {
        name: "slides.compact",
        // Serial: compaction appends a Base against the current head, so it
        // has to be ordered against the mutations that move it.
        queueType: "serial",
        work: () => slides.compact(intent.deckId)
      };
    // Compute is concurrent because it only talks to Derived Outputs; settle is
    // serial because it writes a revision against the head, exactly like any
    // other mutation.
    case "slides.prompt.create.compute":
      return {
        name: "slides.prompt.create.compute",
        queueType: "concurrent",
        work: () => slides.computePromptCreation(intent.attemptId)
      };
    case "slides.prompt.create.settle":
      return {
        name: "slides.prompt.create.settle",
        queueType: "serial",
        work: () => slides.settlePromptCreation(intent.attemptId)
      };
    case "slides.prompt.refresh.compute":
      return {
        name: "slides.prompt.refresh.compute",
        queueType: "concurrent",
        work: () => slides.computePromptRefresh(intent.attemptId)
      };
    case "slides.prompt.refresh.settle":
      return {
        name: "slides.prompt.refresh.settle",
        queueType: "serial",
        work: () => slides.settlePromptRefresh(intent.attemptId)
      };
    default:
      // Formula evaluation arrives with Phase 6. Its intent types already exist
      // in the union, so this is a gap rather than a fallthrough, and it says so.
      throw new Error(`Slides internal job is not implemented yet: ${intent.type}`);
  }
};
