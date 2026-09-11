import {
  EDITOR_CATEGORY,
  answersFrom,
  draftOf,
  editTemplate,
  instantiateTemplate,
  termFor,
  updateTemplateSlotDescription,
  updateTemplateSlotDefault,
  withTerm,
  withWholeProject,
  withoutTerm,
  wordsFrom,
  type LibraryTemplateDetail,
  type OfferSource,
  type ScopeDraft,
  type ScopeSide,
  type TemplateAnswers,
  type TemplateSlot
} from "$app-views/categories/templates/procedures/library.svelte";
import type { WorkspaceStateModel } from "$model/client/workspace-state";

type Context = {
  readonly view: WorkspaceStateModel;
  readonly template: () => LibraryTemplateDetail | undefined;
  readonly pending: () => string | undefined;
  readonly setPending: (value: "use" | "edit" | "default" | "slot" | undefined) => void;
  readonly setError: (value: string | undefined) => void;
  readonly stillInspecting: (tabId: string, subjectId: string) => boolean;
  readonly prepareSlotEditing: () => void;
};

const SPREADSHEET_HANDOFF =
  "Spreadsheet templates are represented and can be materialized, but Use is paused until the spreadsheet editor consumes the created resource id.";

/** Owns the new slot-answering and default-scope workflow in the Template inspector. */
export class TemplatePromptState {
  defaultFor = $state<TemplateSlot | undefined>(undefined);
  defaultOpen = $state(false);
  draft = $state<ScopeDraft>(draftOf(undefined));
  useOpen = $state(false);
  answerOpen = $state(false);
  useChoices = $state<Record<string, ScopeDraft | undefined>>({});
  useTexts = $state<Record<string, string | undefined>>({});
  answering = $state<TemplateSlot | undefined>(undefined);
  editingSlot = $state<string | undefined>(undefined);
  slotDescriptionDraft = $state("");
  slotBase = $state<LibraryTemplateDetail | undefined>(undefined);
  slotEditor = $state<HTMLTextAreaElement | null>(null);

  constructor(private readonly context: Context) {}

  use(): void {
    const template = this.context.template();
    if (template === undefined || this.context.pending() !== undefined) return;
    if (template.makes === "Spreadsheet") {
      this.context.setError(SPREADSHEET_HANDOFF);
      return;
    }
    if (template.slots.length === 0) {
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
    const slot = this.context.template()?.slots.find((candidate) => candidate.name === name);
    if (slot === undefined) return;
    this.answering = slot;
    this.draft = draftOf(this.useChoices[name] ?? slot.default);
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

  startSlotDescription(slot: TemplateSlot): void {
    const template = this.context.template();
    if (template === undefined || !template.canEdit || this.context.pending() !== undefined) return;
    this.context.prepareSlotEditing();
    this.slotBase = template;
    this.editingSlot = slot.name;
    this.slotDescriptionDraft = slot.description ?? "";
    queueMicrotask(() => {
      this.slotEditor?.focus();
      this.slotEditor?.select();
    });
  }

  cancelSlotDescription(): void {
    this.editingSlot = undefined;
    this.slotDescriptionDraft = "";
    this.slotBase = undefined;
  }

  commitSlotDescription(slot: TemplateSlot): void {
    const subject = this.slotBase;
    if (
      subject === undefined ||
      this.context.template()?.id !== subject.id ||
      this.editingSlot !== slot.name ||
      !subject.canEdit ||
      this.context.pending() !== undefined
    ) return;
    if (this.slotDescriptionDraft.trim() === (slot.description ?? "").trim()) {
      this.cancelSlotDescription();
      return;
    }
    void this.performSlotDescription(subject, slot);
  }

  slotKeydown(event: KeyboardEvent): void {
    if (event.key !== "Escape") return;
    event.preventDefault();
    this.cancelSlotDescription();
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

  openDefault(slot: TemplateSlot): void {
    const template = this.context.template();
    if (template === undefined || !template.canEdit || this.context.pending() !== undefined) return;
    this.defaultFor = slot;
    this.draft = draftOf(slot.default);
    this.defaultOpen = true;
  }

  setDefault(): void {
    const subject = this.context.template();
    const slot = this.defaultFor;
    if (subject === undefined || slot === undefined || this.context.pending() !== undefined) return;
    void this.performDefault(subject, slot, this.draft);
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
    slot: TemplateSlot,
    rule: ScopeDraft
  ): Promise<void> {
    const originTabId = this.context.view.activeId;
    this.context.setPending("default");
    this.context.setError(undefined);
    try {
      const result = await updateTemplateSlotDefault(
        this.context.view,
        subject,
        slot.name,
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

  private async performSlotDescription(
    subject: LibraryTemplateDetail,
    slot: TemplateSlot
  ): Promise<void> {
    const originTabId = this.context.view.activeId;
    this.context.setPending("slot");
    this.context.setError(undefined);
    try {
      const result = await updateTemplateSlotDescription(
        this.context.view,
        subject,
        slot.name,
        this.slotDescriptionDraft
      );
      if (!this.context.stillInspecting(originTabId, subject.id)) return;
      if (!result.accepted) this.context.setError(result.detail);
      else this.cancelSlotDescription();
    } catch (error) {
      if (this.context.stillInspecting(originTabId, subject.id)) {
        this.context.setError(error instanceof Error ? error.message : String(error));
      }
    } finally {
      this.context.setPending(undefined);
    }
  }
}
