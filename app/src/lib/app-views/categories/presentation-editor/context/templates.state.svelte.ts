import {
  answersFrom,
  commitStage,
  presentationTemplatesIn,
  detailIn,
  discardStage,
  draftOf,
  insertionOf,
  mergedSlots,
  openStage,
  saveAsTemplate,
  slotSignal,
  templateDetail,
  termFor,
  updateSlots,
  withSlotField,
  withTerm,
  withWholeProject,
  withoutTerm,
  wordsFrom,
  type ChosenSlot,
  type OfferSource,
  type ScopeDraft,
  type ScopeNames,
  type ScopeSide,
  type TemplateAnswers,
  type TemplateDetail,
  type TemplateSlot,
  type TemplateLibraryItem
} from "$app-views/categories/presentation-editor/procedures/templating";
import { slideSignal } from "$app-views/categories/presentation-editor/procedures/selecting";
import type { PresentationBody } from "$representation/data/types/presentations/body";
import type {
  PresentationRuntime,
  WorkspaceStateModel
} from "$model/client/workspace-state";
import type { ResourceTemplateStage } from "$capabilities/templates/index.remote";

type Context = {
  readonly view: WorkspaceStateModel;
  readonly presentationId: () => string | undefined;
  readonly runtime: () => PresentationRuntime | undefined;
  readonly body: () => PresentationBody | undefined;
  readonly currentSlideId: () => string | null;
  readonly stage: () => ResourceTemplateStage | undefined;
  readonly template: () => TemplateDetail | undefined;
  readonly currentRevision: () => number | null;
};

/** Component-instance state and asynchronous commands for the slide Templates panel. */
export class TemplatesContextState {
  query = $state("");
  nameDraft = $state("");
  pending = $state<string | undefined>(undefined);
  actionError = $state<string | undefined>(undefined);
  notice = $state<readonly string[]>([]);
  defaultFor = $state<TemplateSlot | undefined>(undefined);
  defaultOpen = $state(false);
  draft = $state<ScopeDraft>(draftOf(undefined));
  insertFor = $state<TemplateDetail | undefined>(undefined);
  insertOpen = $state(false);
  answerOpen = $state(false);
  choices = $state<Record<string, ScopeDraft | undefined>>({});
  texts = $state<Record<string, string | undefined>>({});
  answering = $state<TemplateSlot | undefined>(undefined);

  private live = true;

  constructor(private readonly context: Context) {}

  dispose(): void {
    this.live = false;
  }

  private fail(error: unknown): void {
    if (this.live) this.actionError = error instanceof Error ? error.message : String(error);
  }

  private async run(key: string, work: () => Promise<void>): Promise<void> {
    if (this.pending !== undefined) return;
    this.pending = key;
    this.actionError = undefined;
    try {
      await work();
    } catch (error) {
      this.fail(error);
    } finally {
      if (this.live) this.pending = undefined;
    }
  }

  private async settled(): Promise<boolean> {
    const runtime = this.context.runtime();
    if (runtime === undefined) return false;
    await runtime.flush();
    if (runtime.pending > 0) {
      this.actionError = "The presentation has changes that are not saved yet. Save them first.";
      return false;
    }
    return true;
  }

  private show(slideId: string): void {
    const presentationId = this.context.presentationId();
    if (presentationId === undefined) return;
    this.context.view.open({ category: "presentation-editor", resourceId: presentationId, focus: slideId });
    this.context.view.inspect("presentation-editor.slide", slideSignal(slideId).selection);
  }

  showSlot(name: string): void {
    const body = this.context.body();
    const presentationId = this.context.presentationId();
    if (body === undefined || presentationId === undefined) return;
    const target = slotSignal(body, name);
    if (target === undefined) return;
    this.context.view.open({
      category: "presentation-editor",
      resourceId: presentationId,
      focus: target.slideId
    });
    this.context.view.inspect(target.signal.key, target.signal.selection);
  }

  save(): void {
    void this.run("save", async () => {
      const presentationId = this.context.presentationId();
      const stage = this.context.stage();
      const currentRevision = this.context.currentRevision();
      if (presentationId === undefined || stage === undefined || currentRevision === null) return;
      if (!(await this.settled())) return;
      const result = await commitStage(
        this.context.view,
        { stageId: stage.stageId, templateId: stage.templateId, baseRevision: currentRevision },
        presentationId
      );
      if (!this.live) return;
      if (!result.accepted) {
        this.actionError = result.detail;
        return;
      }
      this.notice = result.dropped.length === 0
        ? ["Saved to the template."]
        : ["Saved to the template.", ...result.dropped];
    });
  }

  discard(): void {
    void this.run("discard", async () => {
      const presentationId = this.context.presentationId();
      const stage = this.context.stage();
      if (presentationId === undefined || stage === undefined) return;
      if (!confirm(`Discard the working copy of “${stage.templateName}”? Unsaved edits are lost.`)) return;
      if (!(await this.settled())) return;
      const tab = this.context.view.activeId;
      const result = await discardStage(
        this.context.view,
        { stageId: stage.stageId, templateId: stage.templateId },
        presentationId
      );
      if (!this.live) return;
      if (!result.accepted) {
        this.actionError = result.detail;
        return;
      }
      this.context.view.close(tab);
    });
  }

  saveAs(slideId?: string): void {
    void this.run("save-as", async () => {
      const presentationId = this.context.presentationId();
      const name = this.nameDraft.trim();
      if (presentationId === undefined || name === "") return;
      if (!(await this.settled())) return;
      const made = await saveAsTemplate(this.context.view, presentationId, name, slideId);
      if (!this.live) return;
      if (!made.accepted) {
        this.actionError = made.detail;
        return;
      }
      this.nameDraft = "";
      this.notice = [`Saved as the template “${name}”.`, ...made.dropped];
      const opened = await openStage(this.context.view, made.templateId);
      if (!this.live) return;
      if (!opened.accepted) {
        this.actionError = opened.detail;
        return;
      }
      this.context.view.open({
        category: "presentation-editor",
        resourceId: opened.resourceId,
        context: "presentation-editor.templates"
      });
    });
  }

  edit(item: TemplateLibraryItem): void {
    void this.run(`edit:${item.id}`, async () => {
      const result = await openStage(this.context.view, item.id);
      if (!this.live) return;
      if (!result.accepted) {
        this.actionError = result.detail;
        return;
      }
      this.context.view.open({
        category: "presentation-editor",
        resourceId: result.resourceId,
        context: "presentation-editor.templates"
      });
    });
  }

  private async place(
    detail: TemplateDetail,
    answers: TemplateAnswers,
    words: Readonly<Record<string, string>> = {}
  ): Promise<void> {
    const body = this.context.body();
    const runtime = this.context.runtime();
    const stage = this.context.stage();
    const template = this.context.template();
    const presentationId = this.context.presentationId();
    if (body === undefined || runtime === undefined) return;
    const insertion = insertionOf(
      body,
      detail,
      this.context.currentSlideId(),
      stage === undefined ? "resolve" : "keep",
      answers,
      words
    );
    if (insertion.ops.length === 0) {
      this.notice = ["That template has no slides to insert."];
      return;
    }
    runtime.apply(insertion.ops);
    if (insertion.firstSlideId !== undefined) this.show(insertion.firstSlideId);
    if (stage !== undefined && template !== undefined) {
      const merged = mergedSlots(template.slots, detail.slots);
      if (merged.length !== template.slots.length) {
        const result = await updateSlots(this.context.view, template, merged, presentationId);
        if (this.live && !result.accepted) this.actionError = result.detail;
      }
    }
    this.notice = [`Inserted “${detail.name}”.`];
  }

  insert(item: TemplateLibraryItem): void {
    void this.run(`insert:${item.id}`, async () => {
      if (this.context.body() === undefined || this.context.runtime() === undefined) return;
      const detail = detailIn(await templateDetail(item.id));
      if (detail === undefined) {
        this.actionError = "That template could not be read.";
        return;
      }
      if (this.context.stage() === undefined && detail.slots.length > 0) {
        this.insertFor = detail;
        this.choices = {};
        this.texts = {};
        this.answering = undefined;
        this.insertOpen = true;
        return;
      }
      await this.place(detail, {});
    });
  }

  confirmInsert(): void {
    const detail = this.insertFor;
    if (detail === undefined) return;
    void this.run(`place:${detail.id}`, () =>
      this.place(detail, answersFrom(this.choices), wordsFrom(this.texts))
    );
  }

  changeSlots(next: readonly ChosenSlot[]): void {
    void this.run("slots", async () => {
      const template = this.context.template();
      if (template === undefined) return;
      const result = await updateSlots(this.context.view, template, next, this.context.presentationId());
      if (this.live && !result.accepted) this.actionError = result.detail;
    });
  }

  openDefault(slot: TemplateSlot): void {
    this.defaultFor = slot;
    this.draft = draftOf(slot.default);
    this.defaultOpen = true;
  }

  confirmDefault(): void {
    const template = this.context.template();
    if (template === undefined || this.defaultFor === undefined) return;
    this.changeSlots(
      withSlotField(template.slots, this.defaultFor.name, { default: this.draft })
    );
  }

  openAnswer(name: string): void {
    const slot = this.insertFor?.slots.find((candidate) => candidate.name === name);
    if (slot === undefined) return;
    this.answering = slot;
    this.draft = draftOf(this.choices[name] ?? slot.default);
    this.insertOpen = false;
    this.answerOpen = true;
  }

  confirmAnswer(): void {
    if (this.answering !== undefined) {
      this.choices = { ...this.choices, [this.answering.name]: this.draft };
    }
    this.answering = undefined;
    this.answerOpen = false;
    this.insertOpen = true;
  }

  cancelAnswer(): void {
    this.answering = undefined;
    this.insertOpen = true;
  }

  resetAnswering(): void {
    if (this.answering !== undefined) this.clearAnswer(this.answering.name);
    this.answering = undefined;
    this.answerOpen = false;
    this.insertOpen = true;
  }

  writeText(name: string, words: string): void {
    this.texts = { ...this.texts, [name]: words };
  }

  clearAnswer(name: string): void {
    const { [name]: _chosen, ...restChoices } = this.choices;
    const { [name]: _typed, ...restTexts } = this.texts;
    this.choices = restChoices;
    this.texts = restTexts;
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
}
