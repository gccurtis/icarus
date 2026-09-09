import type { ResearchModeKind } from "$representation/data/types/investigation/research-thread";
import type { ResearchScope } from "$representation/data/types/investigation/research-turn";

export const MODES: readonly ResearchModeKind[] = ["explore", "question", "hypothesis"];

export const MODE_LABEL: Record<ResearchModeKind, string> = {
  explore: "Explore",
  question: "Question",
  hypothesis: "Hypothesis"
};

export const SCOPE_LABEL: Record<ResearchScope["kind"], string> = {
  project: "All project",
  resource: "This resource"
};
