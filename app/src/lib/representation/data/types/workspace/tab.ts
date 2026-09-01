import type { ContextView, InspectorView } from "$representation/data/types/workspace/views";
import type { Category, Subscreen } from "$representation/data/types/workspace/categories";

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
  subscreen: Subscreen;
  focus: string | null;
  contextId: ContextView | null;
  inspected: Inspected;
  selection: Selection | null;
  frame: Frame;
};

export type Landing = Pick<
  TabView,
  "subscreen" | "focus" | "contextId" | "inspected" | "selection"
>;

export type Target = {
  readonly category: Category;
  readonly subscreen?: Subscreen;
  readonly resourceId?: string;
  readonly focus?: string;
};
