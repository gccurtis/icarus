import type { Tool, ToolId } from "$representation/data/types/agents/tool";

export const TOOLS: readonly Tool[] = [
  {
    id: "retrieve",
    name: "Retrieve",
    does: "Searches what the persona may read and quotes passages verbatim.",
    reach: "scope"
  },
  {
    id: "resource.read",
    name: "Read a resource",
    does: "Opens a resource in this project and reads it whole.",
    reach: "project"
  },
  {
    id: "resource.write",
    name: "Edit a resource",
    does: "Edits a resource in place. Every edit is attributed to the task.",
    reach: "project"
  },
  {
    id: "finding.create",
    name: "Write a finding",
    does: "Writes a finding with the evidence it rests on. A person still accepts it.",
    reach: "project"
  },
  {
    id: "analysis.evaluate",
    name: "Run an analysis",
    does: "Runs a saved analysis and reads the result. It cannot change the analysis.",
    reach: "project"
  },
  {
    id: "web.search",
    name: "Search the web",
    does: "Searches the public web. Nothing it returns is bounded by the project.",
    reach: "unbounded"
  }
];

export const TOOL_IDS: readonly ToolId[] = TOOLS.map((tool) => tool.id);

export const DEFAULT_TOOLS: readonly ToolId[] = ["retrieve", "resource.read"];

export const isToolId = (value: unknown): value is ToolId =>
  typeof value === "string" && (TOOL_IDS as readonly string[]).includes(value);

export const toolOf = (id: string): Tool | undefined => TOOLS.find((tool) => tool.id === id);

export const orderedTools = (ids: readonly string[]): readonly ToolId[] =>
  TOOL_IDS.filter((id) => ids.includes(id));
