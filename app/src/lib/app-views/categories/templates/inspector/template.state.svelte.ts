import {
  EDITOR_CATEGORY,
  answersFrom,
  draftOf,
  editTemplate,
  instantiateTemplate,
  termFor,
  updateTemplateHoleDescription,
  updateTemplateHoleDefault,
  withTerm,
  withWholeProject,
  withoutTerm,
  wordsFrom,
  type LibraryTemplateDetail,
  type OfferSource,
  type ScopeDraft,
  type ScopeSide,
  type TemplateAnswers,
  type TemplateHole
} from "$app-views/categories/templates/procedures/library.svelte";
import type { WorkspaceStateModel } from "$model/client/workspace-state";

type Context = {
  readonly view: WorkspaceStateModel;
  readonly template: () => LibraryTemplateDetail | undefined;
  readonly pending: () => string | undefined;
  readonly setPending: (value: "use" | "edit" | "default" | "hole" | undefined) => void;
  readonly setError: (value: string | undefined) => void;
  readonly stillInspecting: (tabId: string, subjectId: string) => boolean;
  readonly prepareHoleEditing: () => void;
};

const SPREADSHEET_HANDOFF =
  "Spreadsheet templates are represented and can be materialized, but Use is paused until the spreadsheet editor consumes the created resource id.";

/** Owns the new hole-answering and default-scope workflow in the Template inspector. */
export class TemplatePromptState {
  defaultFor = $state<TemplateHole | undefined>(undefined);
  defaultOpen = $state(false);
  draft = $state<ScopeDraft>(draftOf(undefined));
  useOpen = $state(false);
  answerOpen = $state(false);
  useChoices = $state<Record<string, ScopeDraft | undefined>>({});
  useTexts = $state<Record<string, string | undefined>>({});
  answering = $state<TemplateHole | undefined>(undefined);
  editingHole = $state<string | undefined>(undefined);
  holeDescriptionDraft = $state("");
  holeBase = $state<LibraryTemplateDetail | undefined>(undefined);
  holeEditor = $state<HTMLTextAreaElement | null>(null);

  constructor(private readonly context: Context) {}

  use(): void {
    const template = this.context.template();
    if (template === undefined || this.context.pending() !== undefined) return;
    if (template.makes === "Spreadsheet") {
      this.context.setError(SPREADSHEET_HANDOFF);
      return;
    }
    if (template.holes.length === 0) {
      void this.instantiate({});
      return;
    }
    this.useChoices = {};
    this.useTexts = {};
    this.answering = undefined;
    this.useOpen = true;
  }

  confirmUse(): void {
    void this.instantiate(answersFrom(this.useChoices), wordsFrom(this.useTexts));
  }

  openAnswer(name: string): void {
    const hole = this.context.template()?.holes.find((candidate) => candidate.name === name);
    if (hole === undefined) return;
    this.answering = hole;
    this.draft = draftOf(this.useChoices[name] ?? hole.default);
    this.useOpen = false;
    this.answerOpen = true;
  }

  confirmAnswer(): void {
    if (this.answering !== undefined) {
      this.useChoices = { ...this.useChoices, [this.answering.name]: this.draft };
    }
    this.answering = undefined;
    this.answerOpen = false;
    this.useOpen = true;
  }

  cancelAnswer(): void {
    this.answering = undefined;
    this.useOpen = true;
  }

  resetAnswering(): void {
    if (this.answering !== undefined) this.clearAnswer(this.answering.name);
    this.answering = undefined;
    this.answerOpen = false;
    this.useOpen = true;
  }

  writeText(name: string, words: string): void {
    this.useTexts = { ...this.useTexts, [name]: words };
  }

  clearAnswer(name: string): void {
    const { [name]: _chosen, ...restChoices } = this.useChoices;
    const { [name]: _typed, ...restTexts } = this.useTexts;
    this.useChoices = restChoices;
    this.useTexts = restTexts;
  }

  addTerm(side: ScopeSide, source: string, key: string): void {
    const term = termFor(source as OfferSource, key);
    if (term !== undefined) this.draft = withTerm(this.draft, side, term);
  }

  dropTerm(side: ScopeSide, key: string): void {
    this.draft = withoutTerm(this.draft, side, key);
  }

  setMode(whole: boolean): void {
    this.draft = whole ? withWholeProject() : { include: [], exclude: [] };
  }

  clearScope(): void {
    this.draft = { include: [], exclude: [] };
  }

  startHoleDescription(hole: TemplateHole): void {
    const template = this.context.template();
    if (template === undefined || !template.canEdit || this.context.pending() !== undefined) return;
    this.context.prepareHoleEditing();
    this.holeBase = template;
    this.editingHole = hole.name;
    this.holeDescriptionDraft = hole.description ?? "";
    queueMicrotask(() => {
      this.holeEditor?.focus();
      this.holeEditor?.select();
    });
  }

  cancelHoleDescription(): void {
    this.editingHole = undefined;
    this.holeDescriptionDraft = "";
    this.holeBase = undefined;
  }

  commitHoleDescription(hole: TemplateHole): void {
    const subject = this.holeBase;
    if (
      subject === undefined ||
      this.context.template()?.id !== subject.id ||
      this.editingHole !== hole.name ||
      !subject.canEdit ||
      this.context.pending() !== undefined
    ) return;
    if (this.holeDescriptionDraft.trim() === (hole.description ?? "").trim()) {
      this.cancelHoleDescription();
      return;
    }
    void this.performHoleDescription(subject, hole);
  }

  holeKeydown(event: KeyboardEvent): void {
    if (event.key !== "Escape") return;
    event.preventDefault();
    this.cancelHoleDescription();
  }

  edit(): void {
    const subject = this.context.template();
    if (subject === undefined || this.context.pending() !== undefined) return;
    if (subject.makes === "Spreadsheet") {
      this.context.setError("Spreadsheet templates open for editing once the spreadsheet editor lands.");
      return;
    }
    void this.performEdit(subject);
  }

  openDefault(hole: TemplateHole): void {
    const template = this.context.template();
    if (template === undefined || !template.canEdit || this.context.pending() !== undefined) return;
    this.defaultFor = hole;
    this.draft = draftOf(hole.default);
    this.defaultOpen = true;
  }

  setDefault(): void {
    const subject = this.context.template();
    const hole = this.defaultFor;
    if (subject === undefined || hole === undefined || this.context.pending() !== undefined) return;
    void this.performDefault(subject, hole, this.draft);
  }

  private async instantiate(
    answers: TemplateAnswers,
    words: Readonly<Record<string, string>> = {}
  ): Promise<void> {
    const subject = this.context.template();
    if (subject === undefined || this.context.pending() !== undefined) return;
    const originTabId = this.context.view.activeId;
    this.context.setPending("use");
    this.context.setError(undefined);
    try {
      const result = await instantiateTemplate(this.context.view, subject, answers, words);
      if (!this.context.stillInspecting(originTabId, subject.id)) return;
      if (!result.accepted) {
        this.context.setError(result.detail);
        return;
      }
      if (result.target === "spreadsheet") {
        this.context.setError(SPREADSHEET_HANDOFF);
        return;
      }
      this.context.view.open({
        category: EDITOR_CATEGORY[result.target],
        resourceId: result.resourceId
      });
    } catch (error) {
      if (this.context.stillInspecting(originTabId, subject.id)) {
        this.context.setError(error instanceof Error ? error.message : String(error));
      }
    } finally {
      this.context.setPending(undefined);
    }
  }

  private async performEdit(subject: LibraryTemplateDetail): Promise<void> {
    const originTabId = this.context.view.activeId;
    this.context.setPending("edit");
    this.context.setError(undefined);
    try {
      const result = await editTemplate(this.context.view, subject);
      if (!this.context.stillInspecting(originTabId, subject.id)) return;
      if (!result.accepted) this.context.setError(result.detail);
    } catch (error) {
      if (this.context.stillInspecting(originTabId, subject.id)) {
        this.context.setError(error instanceof Error ? error.message : String(error));
      }
    } finally {
      this.context.setPending(undefined);
    }
  }

  private async performDefault(
    subject: LibraryTemplateDetail,
    hole: TemplateHole,
    rule: ScopeDraft
  ): Promise<void> {
    const originTabId = this.context.view.activeId;
    this.context.setPending("default");
    this.context.setError(undefined);
    try {
      const result = await updateTemplateHoleDefault(
        this.context.view,
        subject,
        hole.name,
        rule
      );
      if (!this.context.stillInspecting(originTabId, subject.id)) return;
      if (!result.accepted) this.context.setError(result.detail);
    } catch (error) {
      if (this.context.stillInspecting(originTabId, subject.id)) {
        this.context.setError(error instanceof Error ? error.message : String(error));
      }
    } finally {
      this.context.setPending(undefined);
    }
  }

  private async performHoleDescription(
    subject: LibraryTemplateDetail,
    hole: TemplateHole
  ): Promise<void> {
    const originTabId = this.context.view.activeId;
    this.context.setPending("hole");
    this.context.setError(undefined);
    try {
      const result = await updateTemplateHoleDescription(
        this.context.view,
        subject,
        hole.name,
        this.holeDescriptionDraft
      );
      if (!this.context.stillInspecting(originTabId, subject.id)) return;
      if (!result.accepted) this.context.setError(result.detail);
      else this.cancelHoleDescription();
    } catch (error) {
      if (this.context.stillInspecting(originTabId, subject.id)) {
        this.context.setError(error instanceof Error ? error.message : String(error));
      }
    } finally {
      this.context.setPending(undefined);
    }
  }
}
