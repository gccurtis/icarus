import type { ContextView } from "$representation/data/types/workspace/views";
import type {
  Frame,
  Inspected,
  Landing,
  Selection,
  TabId,
  TabView,
  Target
} from "$representation/data/types/workspace/tab";

export type WorkspaceOp =
  | { op: "open"; tab: TabId; at: number; target: Target; view: TabView }
  | { op: "close"; tab: TabId; at: number; target: Target; view: TabView }
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
