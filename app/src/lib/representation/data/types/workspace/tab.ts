import type { ContextView, InspectorView } from "$representation/data/types/workspace/views";
import type { Category, ContentView } from "$representation/data/types/workspace/categories";

export type TabId = string;

export type Inspected = InspectorView | "empty";

export type SelectionRange = {
  readonly id: string;
  readonly at: string;
};

export type Selection = {
  readonly kind: string;
  readonly id: string;
  readonly at?: string;
  readonly ranges?: readonly SelectionRange[];
  readonly ids?: readonly string[];
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
  zoom: number | null;
};

export type Landing = Pick<
  TabView,
  "content" | "focus" | "contextId" | "inspected" | "selection"
>;

export type Target = {
  readonly category: Category;
  readonly content?: ContentView;
  readonly context?: ContextView;
  readonly resourceId?: string;
  readonly focus?: string;
};
