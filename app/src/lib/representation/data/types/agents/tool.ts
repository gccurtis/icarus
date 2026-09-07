export type ToolId =
  | "retrieve"
  | "resource.read"
  | "resource.write"
  | "finding.create"
  | "analysis.evaluate"
  | "web.search";

export type ToolReach = "scope" | "project" | "unbounded";

export type Tool = {
  id: ToolId;
  name: string;
  does: string;
  reach: ToolReach;
};
