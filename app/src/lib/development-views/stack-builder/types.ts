export type NodeSource = "authored" | "vendored";

export type ComponentNode = {
  kind: "component";
  id: string;
  source: NodeSource;
  name: string;
  path: string;
  description: string;
};

export type CustomNode = {
  kind: "custom";
  id: string;
  name: string;
  description: string;
};

export type SubstackNode = {
  kind: "substack";
  id: string;
  name: string;
  description: string;
  children: StackNode[];
};

export type StackNode = ComponentNode | CustomNode | SubstackNode;

export type Manifest = {
  slug: string;
  title: string;
  nodes: StackNode[];
};

export type CatalogueEntry = {
  id: string;
  source: NodeSource;
  name: string;
  family: string;
  path: string;
  reason: string;
};

export type ModelChoice = {
  id: string;
  label: string;
};

export type ManifestRecord = {
  at: string;
  kind: "manifest";
  title: string;
  nodes: StackNode[];
};

export type MockRecord = {
  at: string;
  kind: "mock";
  revision: number;
  model: string;
  feedback: string;
};

export type SavedRecord = {
  at: string;
  kind: "saved";
  file: string;
};

export type LogRecord = ManifestRecord | MockRecord | SavedRecord;

export type ComponentSource = {
  name: string;
  path: string;
};
