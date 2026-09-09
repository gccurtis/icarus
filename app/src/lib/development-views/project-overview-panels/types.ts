import type { Component } from "svelte";

export type PanelReferenceId =
  | "overview"
  | "history"
  | "person"
  | "comment"
  | "activity"
  | "resource";

export type PanelSurface = "context" | "inspector";

/**
 * How close a displayed fact is to a usable application read.
 *
 * This vocabulary is deliberately about the current code, not about whether a
 * field happens to exist in seed JSON. A represented field behind the wrong
 * boundary is still not data a browser view can honestly claim to have.
 */
export type SourceReadiness = "available" | "join" | "capability" | "missing";

export type PanelSource = {
  readonly label: string;
  readonly read: string;
  readonly owner: string;
  readonly provides: string;
  readonly readiness: SourceReadiness;
  readonly note: string;
};

export type PanelReference = {
  readonly id: PanelReferenceId;
  readonly label: string;
  readonly surface: PanelSurface;
  readonly viewKey: string;
  readonly destination: string;
  readonly implementation: "placeholder" | "existing";
  readonly purpose: string;
  readonly selection: string;
  readonly component: Component<{ stress?: boolean }>;
  readonly sources: readonly PanelSource[];
  readonly decisions: readonly string[];
};
