import type { WorkspaceStateModel } from "$model/client/workspace-state";
import type { ToolId } from "$representation/data/types/agents/tool";

/** One of the five things this category can put in the inspector. */
export type Inspectable =
  | { readonly kind: "persona"; readonly id: string }
  | { readonly kind: "task"; readonly id: string }
  | { readonly kind: "automation"; readonly id: string }
  | { readonly kind: "activity"; readonly id: string }
  | { readonly kind: "tool"; readonly id: ToolId; readonly at: string };

const LENS = {
  persona: "agents.persona",
  task: "agents.task",
  automation: "agents.automation",
  activity: "agents.activity",
  tool: "agents.tool"
} as const;

/**
 * The lens and the selection are chosen together, because a lens drawn over the
 * wrong kind of selection is the one way this category can show a blank panel.
 */
export const inspectAgent = (view: WorkspaceStateModel, target: Inspectable): void => {
  view.inspect(LENS[target.kind], target);
};
