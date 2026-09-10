export type ProjectPanelActor = {
  readonly kind: "person" | "agent" | "connector" | "system";
  readonly label: string;
  readonly id?: string;
};

export type ProjectActivityTarget = {
  readonly kind: string;
  readonly id: string;
  readonly label: string;
};

export type ProjectActivityEntry = {
  readonly id: string;
  readonly at: number;
  /** The name recorded at the time of the event. */
  readonly actorLabel: string;
  /** A current, inspectable actor when one remains visible in this project. */
  readonly actor: ProjectPanelActor | null;
  readonly verb: string;
  readonly target: ProjectActivityTarget;
  readonly context?: ProjectActivityTarget;
  readonly detail?: string;
};

export type ReadProjectOverviewResult = {
  readonly projectId: string;
  readonly viewerId: string;
  readonly name: string;
  readonly description: string;
  readonly status: "active" | "archived";
  readonly viewerRole: string;
  readonly createdAt: number;
  readonly people: readonly {
    readonly id: string;
    readonly name: string;
    readonly role: string;
  }[];
} | null;

export type ReadProjectHistoryInput = {
  readonly search: string;
  readonly since: number | null;
  readonly before: number | null;
  readonly limit: number;
};

export type ReadProjectHistoryResult = {
  readonly entries: readonly ProjectActivityEntry[];
  /** All records matching the search inside the selected time window. */
  readonly matched: number;
  /** All records inside the selected time window, before search. */
  readonly total: number;
  readonly hasMore: boolean;
};

export type ReadProjectPersonInput = {
  readonly userId: string;
};

export type ProjectPersonDetail = {
  readonly id: string;
  readonly name: string;
  readonly email?: string;
  readonly imageUrl?: string;
  readonly role: string;
  readonly joinedAt: number;
  readonly contribution: {
    readonly events: number;
    readonly comments: number;
    readonly resources: number;
  };
  readonly recentActivity: readonly ProjectActivityEntry[];
};

export type ReadProjectPersonResult = ProjectPersonDetail | null;

export type ReadProjectActivityInput = {
  readonly activityId: string;
};

export type ReadProjectActivityResult = ProjectActivityEntry | null;

export type ProjectResourceKind =
  | "document"
  | "slides"
  | "spreadsheet"
  | "research"
  | "finding";

export type ReadProjectResourceInput = {
  readonly resourceId: string;
};

export type ProjectResourceFact = {
  readonly label: string;
  readonly value: string;
};

export type ProjectResourceDetail = {
  readonly id: string;
  readonly kind: ProjectResourceKind;
  readonly name: string;
  readonly createdAt: number;
  readonly createdBy: ProjectPanelActor | null;
  readonly summary: string;
  readonly facts: readonly ProjectResourceFact[];
  readonly recentActivity: readonly ProjectActivityEntry[];
  readonly openable: boolean;
};

export type ReadProjectResourceResult = ProjectResourceDetail | null;

export type ReadProjectCommentInput = {
  readonly threadId: string;
};

export type ProjectCommentAnchor =
  | { readonly kind: "document-text"; readonly blockId: string }
  | { readonly kind: "slide"; readonly slideId: string }
  | { readonly kind: "element"; readonly elementId: string }
  | { readonly kind: "cell"; readonly rowId: string; readonly columnId: string }
  | null;

export type ProjectCommentRemark = {
  readonly id: string;
  readonly at: number;
  readonly author: ProjectPanelActor | null;
  /** Present only while the historical actor remains inspectable in this project. */
  readonly authorLabel?: string;
  readonly text: string;
};

export type ProjectCommentDetail = {
  readonly id: string;
  readonly state: "open" | "resolved";
  readonly target: {
    readonly id: string;
    readonly kind: ProjectResourceKind;
    readonly name: string;
  };
  readonly anchor: ProjectCommentAnchor;
  readonly selectedText?: string;
  readonly selectedBy: ProjectPanelActor | null;
  readonly selectedAt: number;
  readonly opening: ProjectCommentRemark | null;
  readonly replies: readonly ProjectCommentRemark[];
};

export type ReadProjectCommentResult = ProjectCommentDetail | null;

export type UpdateProjectResourceSummaryInput = {
  readonly resourceId: string;
  readonly summary: string;
};

export type UpdateProjectResourceSummaryResult = {
  readonly resourceId: string;
  readonly summary: string;
  readonly updatedAt: number;
};
