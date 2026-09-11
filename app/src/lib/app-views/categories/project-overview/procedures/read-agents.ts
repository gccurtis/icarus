import { readAgentsLibrary } from "$capabilities/agents/index.remote";

/** Read the scoped Agents index only when the selected activity targets Agents. */
export const projectAgents = (targetKind: string | undefined) =>
  targetKind === "persona" || targetKind === "task" || targetKind === "automation"
    ? readAgentsLibrary()
    : undefined;
