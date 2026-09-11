import type { TemplateDetail, TemplateTarget as StoredTemplateTarget } from "$capabilities/templates/index.remote";
import type { Category } from "$model/client/workspace-state";

export type TemplateTarget = "Document" | "Presentation" | "Spreadsheet";
export type TemplateScope = "Project" | "Personal";

export type TemplateSlot = TemplateDetail["slots"][number] & { readonly id: string };

export type LibraryTemplate = {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly makes: TemplateTarget;
  readonly scope: TemplateScope;
  readonly tags: readonly string[];
  readonly slotCount: number;
  readonly createdBy: string;
  readonly revision: number;
  readonly updatedAt: number;
  readonly updated: string;
  readonly lastUsedAt: number | null;
  readonly lastUsed?: string;
  readonly canEdit: boolean;
  readonly canDelete: boolean;
};

export type LibraryTemplateDetail = LibraryTemplate & {
  readonly slots: readonly TemplateSlot[];
  readonly prompts: Readonly<Record<string, string>>;
};

export type TemplateLibrarySummary = {
  readonly total: number;
  readonly project: number;
  readonly personal: number;
  readonly documents: number;
  readonly presentations: number;
  readonly spreadsheets: number;
};

export const EDITOR_CATEGORY: Record<Exclude<StoredTemplateTarget, "spreadsheet">, Category> = {
  document: "document-editor",
  presentation: "presentation-editor"
};
