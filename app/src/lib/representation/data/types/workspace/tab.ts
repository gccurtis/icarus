import type { ContextView, InspectorView } from "$representation/data/types/workspace/views";
import type { Category, ContentView } from "$representation/data/types/workspace/categories";

export type TabId = string;

export type Inspected = InspectorView | "empty";

export type Selection = {
  readonly kind: string;
  readonly id: string;
  readonly at?: string;
};

export type Frame = {
  contextWidth: number;
  contextCollapsed: boolean;
  inspectorWidth: number;
  inspectorCollapsed: boolean;
};

export type TabRecord = {
  readonly id: TabId;
  readonly category: Category;
  readonly resourceId?: string;
};

export type TabView = {
  content: ContentView;
  focus: string | null;
  contextId: ContextView | null;
  inspected: Inspected;
  selection: Selection | null;
  frame: Frame;
  /**
   * Per cent. What this tab's centre is drawn at, never what it is.
   *
   * Beside `frame` rather than in it: the frame is the shell's geometry, which
   * the panels own between them, and zoom is the centre's alone.
   *
   * `null` is nothing decided, which each centre answers for itself: a document
   * fills the width it is given and goes on filling it as that width changes,
   * until someone zooms and a number takes over for good.
   */
  zoom: number | null;
};

export type Landing = Pick<
  TabView,
  "content" | "focus" | "contextId" | "inspected" | "selection"
>;

export type Target = {
  readonly category: Category;
  readonly content?: ContentView;
  readonly resourceId?: string;
  readonly focus?: string;
};
