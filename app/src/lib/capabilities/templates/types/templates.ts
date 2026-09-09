import type { ResourceSet } from "$representation/data/types/core/resource-set";
import type {
  TemplateBody,
  TemplateHole
} from "$representation/data/types/templates/template";

export type TemplateTarget = TemplateBody["resource"];

export type TemplateStageTarget = Exclude<TemplateTarget, "spreadsheet">;

export type TemplateAvailability = "project" | "personal";

export type TemplateAnswers = Readonly<Record<string, ResourceSet>>;

export type TemplateLibraryItem = {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly target: TemplateTarget;
  readonly availability: TemplateAvailability;
  readonly tags: readonly string[];
  readonly holeCount: number;
  readonly createdByName: string;
  readonly revision: number;
  readonly updatedAt: number;
  readonly lastUsedAt: number | null;
  readonly canEdit: boolean;
  readonly canDelete: boolean;
};

export type TemplateDetail = Omit<TemplateLibraryItem, "holeCount"> & {
  readonly body: TemplateBody;
  readonly holes: readonly TemplateHole[];
};

export type TemplateUnavailable = {
  readonly unavailable: true;
  readonly templateId: string;
  readonly reason: "corrupt";
  readonly detail: string;
};

export type ReadTemplateLibraryResult = {
  readonly templates: readonly TemplateLibraryItem[];
  readonly unavailable: readonly TemplateUnavailable[];
};

export type ReadTemplateInput = { readonly templateId: string };
export type ReadTemplateResult = TemplateDetail | TemplateUnavailable | null;

export type CreateTemplateInput = {
  readonly target: TemplateTarget;
  readonly name: string;
  readonly description?: string;
  readonly tags?: readonly string[];
};

export type CreateTemplateResult = {
  readonly accepted: true;
  readonly templateId: string;
  readonly target: TemplateTarget;
  readonly revision: 1;
};

export type CreateTemplateFromResourceInput = {
  readonly target: TemplateStageTarget;
  readonly resourceId: string;
  readonly name: string;
  readonly description?: string;
  readonly tags?: readonly string[];
  readonly slideId?: string;
};

export type CreateTemplateFromResourceResult =
  | {
      readonly accepted: true;
      readonly templateId: string;
      readonly target: TemplateStageTarget;
      readonly revision: 1;
      readonly dropped: readonly string[];
    }
  | {
      readonly accepted: false;
      readonly resourceId: string;
      readonly reason: "not-found" | "unsupported-body";
      readonly detail: string;
    };

export type UpdateTemplatePatch = {
  readonly name?: string;
  readonly description?: string | null;
  readonly tags?: readonly string[];
  readonly holeDescription?: {
    readonly name: string;
    readonly description: string | null;
  };
  readonly holes?: readonly TemplateHole[];
};

export type UpdateTemplateInput = {
  readonly templateId: string;
  readonly baseRevision: number;
  readonly patch: UpdateTemplatePatch;
};

export type UpdateTemplateResult =
  | { readonly accepted: true; readonly templateId: string; readonly revision: number }
  | {
      readonly accepted: false;
      readonly templateId: string;
      readonly reason: "not-found" | "stale" | "unsupported-body" | "hole-in-use";
      readonly revision: number | null;
      readonly detail: string;
    };

export type DuplicateTemplateInput = {
  readonly templateId: string;
  readonly name?: string;
};

export type DuplicateTemplateResult =
  | {
      readonly accepted: true;
      readonly templateId: string;
      readonly sourceTemplateId: string;
      readonly target: TemplateTarget;
      readonly revision: 1;
    }
  | {
      readonly accepted: false;
      readonly templateId: string;
      readonly reason: "not-found" | "unsupported-body";
      readonly revision: number | null;
      readonly detail: string;
    };

export type RemoveTemplateInput = {
  readonly templateId: string;
  readonly baseRevision: number;
};

export type RemoveTemplateResult =
  | { readonly accepted: true; readonly templateId: string; readonly revision: number }
  | {
      readonly accepted: false;
      readonly templateId: string;
      readonly reason:
        | "not-found"
        | "forbidden"
        | "stale"
        | "in-use-elsewhere"
        | "unsupported-body";
      readonly revision: number | null;
      readonly detail: string;
    };

/** What a caller typed into the template's text holes, by name. */
export type TemplateTexts = Readonly<Record<string, string>>;

export type InstantiateTemplateInput = {
  readonly templateId: string;
  readonly name?: string;
  readonly answers?: TemplateAnswers;
  readonly texts?: TemplateTexts;
};

export type InstantiateTemplateResult =
  | {
      readonly accepted: true;
      readonly templateId: string;
      readonly templateRevision: number;
      readonly target: TemplateTarget;
      readonly resourceId: string;
      readonly revision: 0;
    }
  | {
      readonly accepted: false;
      readonly templateId: string;
      readonly reason: "not-found" | "unsupported-body";
      readonly revision: number | null;
      readonly detail: string;
    };

export type OpenTemplateStageInput = { readonly templateId: string };

export type OpenTemplateStageResult =
  | {
      readonly accepted: true;
      readonly stageId: string;
      readonly templateId: string;
      readonly templateRevision: number;
      readonly target: TemplateStageTarget;
      readonly resourceId: string;
      readonly reused: boolean;
    }
  | {
      readonly accepted: false;
      readonly templateId: string;
      readonly reason: "not-found" | "unsupported-body";
      readonly revision: number | null;
      readonly detail: string;
    };

export type ReadResourceTemplateInput = { readonly resourceId: string };

export type ResourceTemplateStage = {
  readonly stageId: string;
  readonly templateId: string;
  readonly templateName: string;
  readonly target: TemplateStageTarget;
  readonly stagedRevision: number;
  readonly currentRevision: number | null;
};

export type ReadResourceTemplateResult = {
  readonly resourceId: string;
  readonly stage: ResourceTemplateStage | null;
};

export type CommitTemplateStageInput = {
  readonly stageId: string;
  readonly baseRevision: number;
};

export type CommitTemplateStageResult =
  | {
      readonly accepted: true;
      readonly stageId: string;
      readonly templateId: string;
      readonly revision: number;
      readonly dropped: readonly string[];
    }
  | {
      readonly accepted: false;
      readonly stageId: string;
      readonly templateId: string | null;
      readonly reason: "not-found" | "stale" | "unsupported-body";
      readonly revision: number | null;
      readonly detail: string;
    };

export type DiscardTemplateStageInput = { readonly stageId: string };

export type DiscardTemplateStageResult =
  | {
      readonly accepted: true;
      readonly stageId: string;
      readonly templateId: string;
      readonly target: TemplateStageTarget;
      readonly resourceId: string;
    }
  | {
      readonly accepted: false;
      readonly stageId: string;
      readonly reason: "not-found";
      readonly detail: string;
    };
