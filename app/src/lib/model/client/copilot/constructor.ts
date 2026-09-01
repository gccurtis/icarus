import { Copilot } from "$model/client/copilot/definition.svelte";
import type { CopilotModel } from "$model/client/copilot/types";

export const createCopilot = (): CopilotModel => new Copilot();
