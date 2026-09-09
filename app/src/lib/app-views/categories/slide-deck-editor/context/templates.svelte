<script lang="ts">
  import { onDestroy } from "svelte";

  import { OverlayModal } from "$authored-components/overlay";
  import {
    Panel,
    PanelBanner,
    PanelButton,
    PanelChip,
    PanelEditableText,
    PanelEmpty,
    PanelInput,
    PanelNote,
    PanelRow,
    PanelSearch,
    PanelSection
  } from "$authored-components/panel";
  import { ScopeBuilder } from "$authored-components/scope-builder";
  import { TemplateAnswers as TemplateAnswerList } from "$authored-components/template-answers";
  import { slideIndexOf } from "$app-views/categories/slide-deck-editor/procedures/deck";
  import { slideSignal } from "$app-views/categories/slide-deck-editor/procedures/selecting";
  import {
    answerRowsOf,
    answersFrom,
    builderView,
    missingIn,
    wordsFrom,
    commitStage,
    deckTemplatesIn,
    detailIn,
    discardStage,
    draftOf,
    insertionOf,
    mergedHoles,
    offeringOf,
    promptWordsIn,
    openStage,
    projectResources,
    resourceSets,
    resourceTemplate,
    resourcesIn,
    ruleOf,
    saveAsTemplate,
    scopeNamesOf,
    setsIn,
    stageIn,
    templateDetail,
    templateLibrary,
    termFor,
    textHoleInsertion,
    updateHoles,
    withHoleField,
    withNewTextHole,
    withTerm,
    withWholeProject,
    withoutTerm,
    type ChosenHole,
    type OfferSource,
    type ScopeDraft,
    type ScopeSide,
    type TemplateAnswers,
    type TemplateDetail,
    type TemplateHole,
    type TemplateLibraryItem
  } from "$app-views/categories/slide-deck-editor/procedures/templating";
  import { readStore, workspaceState, type SlideDeckRuntime } from "$model/client/workspace-state";

  const view = workspaceState();
  let live = true;
  onDestroy(() => {
    live = false;
  });

  const deckId = $derived(view.active.resourceId);
  let runtime = $state<SlideDeckRuntime | undefined>(undefined);
  $effect(() => {
    runtime = deckId === undefined ? undefined : view.slideDeckRuntime(deckId);
  });

  const body = $derived(runtime?.body);
  const decksQuery = readStore("slideDecks");
  const title = $derived.by(() => {
    if (!decksQuery.ready) return undefined;
    const found = decksQuery.current;
    if (found?.kind !== "table" || found.table !== "slideDecks") return undefined;
    return found.rows.find((deck) => deck._id === deckId)?.title;
  });
  const current = $derived(body === undefined ? undefined : body.slides[slideIndexOf(body, view.active.focus ?? undefined)]);
  const position = $derived(body === undefined || current === undefined ? 0 : slideIndexOf(body, current.id) + 1);

  const library = templateLibrary();
  const sets = resourceSets();
  const index = projectResources();
  const setItems = $derived(setsIn(sets.ready ? sets.current : undefined));
  const catalogue = $derived(resourcesIn(index.ready ? index.current : undefined));
  const setNames = $derived(scopeNamesOf(setItems, catalogue));
  const offering = $derived(offeringOf(setItems, catalogue));
  const resourceQuery = $derived(deckId === undefined ? undefined : resourceTemplate(deckId));
  const resource = $derived(resourceQuery?.ready ? resourceQuery.current : undefined);
  const stage = $derived(stageIn(resource));
  const detailQuery = $derived(templateDetail(stage?.templateId));
  const template = $derived(detailIn(detailQuery?.ready ? detailQuery.current : undefined));
  const templates = $derived(deckTemplatesIn(library.ready ? library.current : undefined));
  const currentRevision = $derived(template?.revision ?? stage?.currentRevision ?? null);

  let query = $state("");
  let nameDraft = $state("");
  let pending = $state<string | undefined>(undefined);
  let actionError = $state<string | undefined>(undefined);
  let notice = $state<readonly string[]>([]);
  let defaultFor = $state<TemplateHole | undefined>(undefined);
  let defaultOpen = $state(false);
  let draft = $state<ScopeDraft>(draftOf(undefined));
  let insertFor = $state<TemplateDetail | undefined>(undefined);
  let insertOpen = $state(false);
  let answerOpen = $state(false);
  let choices = $state<Record<string, ScopeDraft | undefined>>({});
  let texts = $state<Record<string, string | undefined>>({});
  let answering = $state<TemplateHole | undefined>(undefined);

  const askRows = $derived(answerRowsOf(insertFor?.holes ?? [], choices, texts, setNames));
  const askBlocked = $derived(
    missingIn(askRows).length === 0 ? undefined : `${missingIn(askRows).join(", ")} still needs words.`
  );

  const shown = $derived(
    templates.filter((item) => item.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  );

  const fail = (error: unknown) => {
    if (live) actionError = error instanceof Error ? error.message : String(error);
  };

  const run = async (key: string, work: () => Promise<void>) => {
    if (pending !== undefined) return;
    pending = key;
    actionError = undefined;
    try {
      await work();
    } catch (error) {
      fail(error);
    } finally {
      if (live) pending = undefined;
    }
  };

  const settled = async (): Promise<boolean> => {
    if (runtime === undefined) return false;
    await runtime.flush();
    if (runtime.pending > 0) {
      actionError = "The deck has changes that are not saved yet. Save them first.";
      return false;
    }
    return true;
  };

  const show = (slideId: string) => {
    if (deckId === undefined) return;
    view.open({ category: "slide-deck-editor", resourceId: deckId, focus: slideId });
    view.inspect("slide-deck-editor.slide", slideSignal(slideId).selection);
  };

  const save = () =>
    run("save", async () => {
      if (deckId === undefined || stage === undefined || currentRevision === null) return;
      if (!(await settled())) return;
      const result = await commitStage(
        view,
        { stageId: stage.stageId, templateId: stage.templateId, baseRevision: currentRevision },
        deckId
      );
      if (!live) return;
      if (!result.accepted) {
        actionError = result.detail;
        return;
      }
      notice = result.dropped.length === 0 ? ["Saved to the template."] : ["Saved to the template.", ...result.dropped];
    });

  const discard = () =>
    run("discard", async () => {
      if (deckId === undefined || stage === undefined) return;
      if (!confirm(`Discard the working copy of “${stage.templateName}”? Unsaved edits are lost.`)) return;
      if (!(await settled())) return;
      const tab = view.activeId;
      const result = await discardStage(view, { stageId: stage.stageId, templateId: stage.templateId }, deckId);
      if (!live) return;
      if (!result.accepted) {
        actionError = result.detail;
        return;
      }
      view.close(tab);
    });

  const saveAs = (slideId?: string) =>
    run("save-as", async () => {
      const name = nameDraft.trim();
      if (deckId === undefined || name === "") return;
      /** A template is made from the saved body, so anything still in flight has to land first. */
      if (!(await settled())) return;
      const made = await saveAsTemplate(view, deckId, name, slideId);
      if (!live) return;
      if (!made.accepted) {
        actionError = made.detail;
        return;
      }
      nameDraft = "";
      notice = [`Saved as the template “${name}”.`, ...made.dropped];
      const opened = await openStage(view, made.templateId);
      if (!live) return;
      if (!opened.accepted) {
        actionError = opened.detail;
        return;
      }
      view.open({
        category: "slide-deck-editor",
        resourceId: opened.resourceId,
        context: "slide-deck-editor.templates"
      });
    });

  const edit = (item: TemplateLibraryItem) =>
    run(`edit:${item.id}`, async () => {
      const result = await openStage(view, item.id);
      if (!live) return;
      if (!result.accepted) {
        actionError = result.detail;
        return;
      }
      view.open({
        category: "slide-deck-editor",
        resourceId: result.resourceId,
        context: "slide-deck-editor.templates"
      });
    });

  const place = async (
    detail: TemplateDetail,
    answers: TemplateAnswers,
    words: Readonly<Record<string, string>> = {}
  ) => {
    if (body === undefined || runtime === undefined) return;
    const insertion = insertionOf(
      body,
      detail,
      current?.id ?? null,
      stage === undefined ? "resolve" : "keep",
      answers,
      words
    );
    if (insertion.ops.length === 0) {
      notice = ["That template has no slides to insert."];
      return;
    }
    runtime.apply(insertion.ops);
    if (insertion.firstSlideId !== undefined) show(insertion.firstSlideId);
    if (stage !== undefined && template !== undefined) {
      const merged = mergedHoles(template.holes, detail.holes);
      if (merged.length !== template.holes.length) {
        const result = await updateHoles(view, template, merged, deckId);
        if (live && !result.accepted) actionError = result.detail;
      }
    }
    notice = [`Inserted “${detail.name}”.`];
  };

  const insert = (item: TemplateLibraryItem) =>
    run(`insert:${item.id}`, async () => {
      if (body === undefined || runtime === undefined) return;
      const detail = detailIn(await templateDetail(item.id));
      if (detail === undefined) {
        actionError = "That template could not be read.";
        return;
      }
      if (stage === undefined && detail.holes.length > 0) {
        insertFor = detail;
        choices = {};
        texts = {};
        answering = undefined;
        insertOpen = true;
        return;
      }
      await place(detail, {});
    });

  const confirmInsert = () => {
    const detail = insertFor;
    if (detail === undefined) return;
    void run(`place:${detail.id}`, () => place(detail, answersFrom(choices), wordsFrom(texts)));
  };

  const changeHoles = (next: readonly ChosenHole[]) =>
    run("holes", async () => {
      if (template === undefined) return;
      const result = await updateHoles(view, template, next, deckId);
      if (live && !result.accepted) actionError = result.detail;
    });

  const openDefault = (hole: TemplateHole) => {
    defaultFor = hole;
    draft = draftOf(hole.default);
    defaultOpen = true;
  };

  const confirmDefault = () => {
    if (template === undefined || defaultFor === undefined) return;
    void changeHoles(withHoleField(template.holes, defaultFor.name, { default: draft }));
  };


  /**
   * The builder is its own modal rather than a second face of the ask modal.
   * Swapping one modal's title, body and confirm while it is open replaces the
   * footer under the pointer, and the press lands on a button that has gone.
   */
  const openAnswer = (name: string) => {
    const hole = insertFor?.holes.find((candidate) => candidate.name === name);
    if (hole === undefined) return;
    answering = hole;
    draft = draftOf(choices[name] ?? hole.default);
    insertOpen = false;
    answerOpen = true;
  };

  const confirmAnswer = () => {
    if (answering !== undefined) choices = { ...choices, [answering.name]: draft };
    answering = undefined;
    answerOpen = false;
    insertOpen = true;
  };

  const cancelAnswer = () => {
    answering = undefined;
    insertOpen = true;
  };

  /** Inside the ask, Default means the template's own suggestion, not the floor. */
  const resetAnswering = () => {
    if (answering !== undefined) clearAnswer(answering.name);
    answering = undefined;
    answerOpen = false;
    insertOpen = true;
  };

  const writeText = (name: string, words: string) => {
    texts = { ...texts, [name]: words };
  };

  const clearAnswer = (name: string) => {
    const { [name]: _chosen, ...restChoices } = choices;
    const { [name]: _typed, ...restTexts } = texts;
    choices = restChoices;
    texts = restTexts;
  };

  /** Every builder edits this one draft, because only one is ever open. */
  const view$ = $derived(builderView(draft, offering));

  const addTerm = (side: ScopeSide, source: string, key: string) => {
    const term = termFor(source as OfferSource, key);
    if (term !== undefined) draft = withTerm(draft, side, term);
  };

  const dropTerm = (side: ScopeSide, key: string) => {
    draft = withoutTerm(draft, side, key);
  };

  const setMode = (whole: boolean) => {
    draft = whole ? withWholeProject() : { include: [], exclude: [] };
  };

  const clearScope = () => {
    draft = { include: [], exclude: [] };
  };

  const busy = $derived(pending !== undefined || body === undefined);
  const unnamed = $derived(nameDraft.trim() === "");
  const scopeBlocked = $derived(
    draft.include.length === 0
      ? "Include something, or choose everything in the project."
      : undefined
  );
</script>

<Panel title="Templates">
  {#snippet actions()}
    {#if deckId !== undefined && stage !== undefined}
      <PanelButton label="Save" tone="primary" disabled={busy} title="Write these slides back to the template" onclick={save} />
      <PanelButton label="Discard" tone="danger" disabled={busy} title="Remove this copy and close it" onclick={discard} />
    {/if}
  {/snippet}

  {#if deckId === undefined}
    <PanelEmpty title="Open a deck to work with templates" />
  {:else}
    {#if actionError}
      <PanelBanner title="That did not happen" tone="attention">{actionError}</PanelBanner>
    {/if}
    {#if notice.length > 0}
      <div class="notice">
        {#each notice as line (line)}
          <PanelNote>{line}</PanelNote>
        {/each}
      </div>
    {/if}

    {#if resourceQuery === undefined || !resourceQuery.ready}
      <PanelNote>Reading this deck…</PanelNote>
    {:else if stage !== undefined}
      <div class="after-verbs">
        <PanelSection title="Holes" count={template?.holes.length} chevron="end">
          {#if template === undefined}
            <PanelNote>Reading the template…</PanelNote>
          {:else if template.holes.length === 0}
            <PanelNote>
              Nothing here is a hole yet. Open a prompt and press Templateify in its Template section.
            </PanelNote>
          {:else}
            {#each template.holes as hole (hole.name)}
              <article class="hole">
                <header>
                  <PanelChip tone="accent-1">{hole.name}</PanelChip>
                  <span class="hole-label">{hole.label}</span>
                </header>
                <PanelEditableText
                  value={hole.description ?? ""}
                  label={`Description for ${hole.label}`}
                  placeholder="What this hole stands for"
                  multiline
                  disabled={busy}
                  onchange={(next) => changeHoles(withHoleField(template.holes, hole.name, { description: next }))}
                />
                {#if hole.kind === "text"}
                  <PanelEditableText
                    value={hole.text ?? ""}
                    label={`Default words for ${hole.label}`}
                    placeholder="What it says when nobody says otherwise"
                    multiline
                    disabled={busy}
                    onchange={(next) => changeHoles(withHoleField(template.holes, hole.name, { text: next }))}
                  />
                {:else}
                  <div class="scope">
                    <PanelButton
                      label="Default scope"
                      disabled={busy}
                      title={`${ruleOf(hole.default, setNames)} — change what ${hole.label} selects by default`}
                      onclick={() => openDefault(hole)}
                    />
                  </div>
                {/if}
              </article>
            {/each}
          {/if}
        </PanelSection>
      </div>
    {:else}
      <div class="save">
        <PanelInput label="Template name" placeholder={title ?? "Template name"} flush bind:value={nameDraft} onenter={() => saveAs()} />
        <div class="save-actions">
          <PanelButton label="Save deck" tone="primary" disabled={busy || unnamed} title={unnamed ? "Give the template a name first" : "Copy the whole deck into a new template and open it"} onclick={() => saveAs()} />
          <PanelButton label="Save slide" disabled={busy || unnamed || current === undefined} title={unnamed ? "Give the template a name first" : `Copy slide ${position} into a new template and open it`} onclick={() => saveAs(current?.id)} />
        </div>
      </div>
    {/if}

    <div class="after-holes">
    <PanelSection title="List" chevron="end" flush>
      {#if library.error}
        <PanelBanner title="Templates unavailable" tone="danger">
          {library.error instanceof Error ? library.error.message : String(library.error)}
        </PanelBanner>
      {:else if !library.ready}
        <PanelNote>Reading the library…</PanelNote>
      {:else if templates.length === 0}
        <PanelEmpty title="No slide deck templates yet" action="Save this deck or a slide as one to start" />
      {:else}
        <PanelSearch placeholder="Search templates…" matched={shown.length} flush bind:value={query}>
          {#each shown as item (item.id)}
            <div class="item">
              <PanelRow title={item.name}>
                <span class="item-title">{item.name}</span>
                <span class="item-sub">{item.holeCount} {item.holeCount === 1 ? "hole" : "holes"} · revision {item.revision}</span>
                <span class="item-actions">
                  <PanelButton label="Insert" tone="ghost" disabled={busy} title={`Insert “${item.name}” after slide ${position}`} onclick={() => insert(item)} />
                  <PanelButton label="Edit" tone="ghost" disabled={busy} title={`Edit “${item.name}” in the editor`} onclick={() => edit(item)} />
                </span>
              </PanelRow>
            </div>
          {/each}
        </PanelSearch>
      {/if}
    </PanelSection>
    </div>
  {/if}
</Panel>

<OverlayModal
  bind:open={insertOpen}
  title={`Insert “${insertFor?.name ?? "the template"}”`}
  description="One hole at a time. The tabs say which still need words."
  confirm="Insert"
  width="wide"
  blocked={askBlocked}
  onconfirm={confirmInsert}
>
  <TemplateAnswerList
    rows={askRows}
    prompts={insertFor === undefined ? {} : promptWordsIn(insertFor.body)}
    onscope={openAnswer}
    ontext={writeText}
    onreset={clearAnswer}
    onaccept={confirmInsert}
  />
</OverlayModal>

<OverlayModal
  bind:open={answerOpen}
  title={`What ${answering?.label ?? "the hole"} selects here`}
  description="For this copy only. Nothing here changes the template."
  confirm="Use this"
  width="wide"
  blocked={scopeBlocked}
  onconfirm={confirmAnswer}
  oncancel={cancelAnswer}
>
  <ScopeBuilder
    {...view$}
    resettable
    onmode={setMode}
    onadd={addTerm}
    ondrop={dropTerm}
    onclear={clearScope}
    onreset={resetAnswering}
  />
</OverlayModal>

<OverlayModal
  bind:open={defaultOpen}
  title={`Default scope for ${defaultFor?.label ?? "the hole"}`}
  description="What it selects until whoever places the template says otherwise."
  confirm="Set the default scope"
  width="wide"
  blocked={scopeBlocked}
  onconfirm={confirmDefault}
>
  <ScopeBuilder {...view$} onmode={setMode} onadd={addTerm} ondrop={dropTerm} onclear={clearScope} />
</OverlayModal>


<style>

  .notice {
    display: flex;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 1);
    margin-bottom: calc(var(--token-spacing-unit) * 2);
  }

  .save {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: calc(var(--token-spacing-unit) * 1);
    margin-bottom: calc(var(--token-spacing-unit) * 2);
    padding: 0 calc(var(--token-spacing-unit) * 3);
  }

  .save-actions {
    display: flex;
    gap: calc(var(--token-spacing-unit) * 1);
  }

  .after-verbs {
    margin-top: calc(var(--token-spacing-unit) * 2);
    padding-top: calc(var(--token-spacing-unit) * 1);
    border-top: 1px solid var(--token-border-subtle);
  }

  .after-holes {
    margin-top: calc(var(--token-spacing-unit) * 2);
    padding-top: calc(var(--token-spacing-unit) * 1);
    border-top: 1px solid var(--token-border-subtle);
  }

  .hole {
    display: flex;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 1.5);
    padding: calc(var(--token-spacing-unit) * 2);
    border: 1px solid var(--token-border-subtle);
    border-radius: var(--token-radius-control);
    background: var(--token-surface-elevated);
  }

  .hole + .hole {
    margin-top: calc(var(--token-spacing-unit) * 1.5);
  }

  .hole header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: calc(var(--token-spacing-unit) * 1.5);
  }

  .hole-label {
    color: var(--token-ink-primary);
    font-size: var(--token-text-body-sm);
    font-weight: 600;
    line-height: var(--token-text-body-sm-leading);
  }

  .scope {
    display: flex;
  }

  .item + .item {
    border-top: 1px solid var(--token-border-subtle);
  }

  .item-title {
    color: var(--token-ink-primary);
    font-size: var(--token-text-body-sm);
    line-height: var(--token-text-body-sm-leading);
    white-space: normal;
  }

  .item-sub {
    color: var(--token-ink-muted);
    font-size: var(--token-text-caption);
    line-height: var(--token-text-caption-leading);
  }

  .item-actions {
    display: flex;
    gap: calc(var(--token-spacing-unit) * 1);
    margin-top: calc(var(--token-spacing-unit) * 1);
  }
</style>
