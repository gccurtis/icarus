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
    default:
      // The prompt and formula stages arrive with Phases 5 and 6. Their intent
      // types already exist in the union, so this is a gap rather than a
      // fallthrough, and it says so.
      throw new Error(`Slides internal job is not implemented yet: ${intent.type}`);
  }
};
