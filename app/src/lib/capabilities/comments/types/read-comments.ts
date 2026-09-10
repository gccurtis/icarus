import type { CommentTarget } from "$representation/data/types/collaboration/comment";

export type CommentActor =
  | { readonly kind: "system" }
  | { readonly kind: "user"; readonly userId: string }
  | { readonly kind: "connector" }
  | { readonly kind: "agent" };

export type { CommentTarget };

export type CommentAnchor =
  | {
      readonly kind: "text";
      readonly spans: {
        readonly blockId: string;
        readonly from: { readonly atom: string; readonly offset: number };
        readonly to: { readonly atom: string; readonly offset: number };
      }[];
    }
  | { readonly kind: "slide"; readonly slideId: string }
  | { readonly kind: "element"; readonly elementId: string }
  | { readonly kind: "cell"; readonly rowId: string; readonly columnId: string };

/** A closed, current-shape comment thread projection. */
export type CommentThreadRecord = {
  readonly _id: string;
  readonly _creationTime: number;
  readonly target: CommentTarget;
  readonly within?: CommentAnchor;
  readonly quote?: string;
  readonly resolution?: { readonly by: string; readonly at: number };
  readonly createdBy: CommentActor;
  readonly updatedAt: number;
};

/** Comment content is projected to the text the browser renders. */
export type CommentRemarkRecord = {
  readonly _id: string;
  readonly _creationTime: number;
  readonly threadId: string;
  readonly text: string;
  readonly author: CommentActor;
  readonly mentionedUserIds: readonly string[];
  readonly editedAt?: number;
};

export type CommentPersonRecord = {
  readonly _id: string;
  readonly displayName: string;
};

export type ReadCommentsResult = {
  readonly viewerId: string;
  readonly threads: readonly CommentThreadRecord[];
  readonly remarks: readonly CommentRemarkRecord[];
  readonly people: readonly CommentPersonRecord[];
};
