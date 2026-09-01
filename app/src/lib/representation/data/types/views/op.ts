import type { ContextId } from "$representation/data/types/views/panels";
import type {
  Frame,
  Inspected,
  Landing,
  Selection,
  TabId,
  TabView,
  Target
} from "$representation/data/types/views/tab";

export type ViewOp =
  | { op: "open"; tab: TabId; at: number; target: Target; view: TabView }
  | { op: "close"; tab: TabId; at: number; target: Target; view: TabView }
  | { op: "activate"; was: TabId; now: TabId }
  | { op: "land"; tab: TabId; was: Landing; now: Landing }
  | { op: "context"; tab: TabId; was: ContextId | null; now: ContextId | null }
  | {
      op: "inspect";
      tab: TabId;
      was: Inspected;
      now: Inspected;
      wasSelection: Selection | null;
      selection: Selection | null;
    }
  | { op: "resize"; tab: TabId; was: Frame; now: Frame };
