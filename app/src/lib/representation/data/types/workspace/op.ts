import type { ContextView } from "$representation/data/types/workspace/views";
import type {
  Frame,
  Inspected,
  Landing,
  Selection,
  TabId,
  TabView
} from "$representation/data/types/workspace/tab";
import type { Category } from "$representation/data/types/workspace/categories";

export type WorkspaceTabTarget = {
  readonly category: Category;
  readonly resourceId?: string;
};

export type WorkspaceOp =
  | { op: "open"; tab: TabId; at: number; target: WorkspaceTabTarget; view: TabView }
  | { op: "close"; tab: TabId; at: number; target: WorkspaceTabTarget; view: TabView }
  | { op: "activate"; was: TabId; now: TabId }
  | { op: "land"; tab: TabId; was: Landing; now: Landing }
  | { op: "context"; tab: TabId; was: ContextView | null; now: ContextView | null }
  | {
      op: "inspect";
      tab: TabId;
      was: Inspected;
      now: Inspected;
      wasSelection: Selection | null;
      selection: Selection | null;
    }
  | { op: "resize"; tab: TabId; was: Frame; now: Frame }
  | { op: "zoom"; tab: TabId; was: number | null; now: number | null };
