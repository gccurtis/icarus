import { readAgentsLibrary } from "$capabilities/agents/index.remote";

/** Start the scoped agent-library query whose snapshot names agent subjects. */
export const tabAgentNames = () => readAgentsLibrary();
