import { readAgentsLibrary } from "$capabilities/agents/index.remote";

/** Start the scoped agent-library query whose snapshot names active subjects. */
export const statusAgentNames = () => readAgentsLibrary();
