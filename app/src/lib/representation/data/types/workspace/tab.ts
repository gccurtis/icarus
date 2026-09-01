import type { ContextId, InspectionKey } from "$representation/data/types/workspace/panels";
import type { Screen, Subscreen } from "$representation/data/types/workspace/screens";

export type TabId = string;

export type Inspected = InspectionKey | "empty";

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
  readonly screen: Screen;
  readonly resourceId?: string;
};

export type TabView = {
  subscreen: Subscreen;
  focus: string | null;
  contextId: ContextId | null;
  inspected: Inspected;
  selection: Selection | null;
  frame: Frame;
};

export type Landing = Pick<
  TabView,
  "subscreen" | "focus" | "contextId" | "inspected" | "selection"
>;

export type Target = {
  readonly screen: Screen;
  readonly subscreen?: Subscreen;
  readonly resourceId?: string;
  readonly focus?: string;
};
