<script lang="ts">
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
  import { TemplatesContextState } from "$app-views/categories/document-editor/context/templates.state.svelte";
  import { rowsIn } from "$app-views/categories/document-editor/procedures/store";
  import {
    answerRowsOf,
    builderView,
    missingIn,
    detailIn,
    documentTemplatesIn,
    promptWordsIn,
    offeringOf,
    projectResources,
    resourceSets,
    resourceTemplate,
    resourcesIn,
    ruleOf,
    scopeNamesOf,
    setsIn,
    stageIn,
    templateDetail,
    templateLibrary,
    withHoleField,
  } from "$app-views/categories/document-editor/procedures/templating";
  import { releaseTemplatesContext } from "$app-views/categories/document-editor/procedures/effects/templates-context.svelte";
  import { workspaceState } from "$model/client/workspace-state";

  const view = workspaceState();
  const documentId = $derived(view.active.resourceId);
  const runtime = $derived(
    documentId === undefined ? undefined : view.documentRuntime(documentId)
  );

  const body = $derived(runtime?.body);
  const title = $derived(rowsIn("documents").find((row) => row._id === documentId)?.title);

  const library = templateLibrary();
  const sets = resourceSets();
  const index = projectResources();
  const setItems = $derived(setsIn(sets.ready ? sets.current : undefined));
  const catalogue = $derived(resourcesIn(index.ready ? index.current : undefined));
  const setNames = $derived(scopeNamesOf(setItems, catalogue));
  const offering = $derived(offeringOf(setItems, catalogue));
  const resourceQuery = $derived(documentId === undefined ? undefined : resourceTemplate(documentId));
  const resource = $derived(resourceQuery?.ready ? resourceQuery.current : undefined);
  const stage = $derived(stageIn(resource));
  const detailQuery = $derived(templateDetail(stage?.templateId));
  const template = $derived(detailIn(detailQuery?.ready ? detailQuery.current : undefined));
  const templates = $derived(documentTemplatesIn(library.ready ? library.current : undefined));
  const currentRevision = $derived(template?.revision ?? stage?.currentRevision ?? null);

  const state = new TemplatesContextState({
    view,
    documentId: () => documentId,
    runtime: () => runtime,
    body: () => body,
    stage: () => stage,
    template: () => template,
    currentRevision: () => currentRevision,
    setNames: () => setNames
  });
  releaseTemplatesContext(state);

  const askRows = $derived(
    answerRowsOf(state.insertFor?.holes ?? [], state.choices, state.texts, setNames)
  );
  const askBlocked = $derived(
    missingIn(askRows).length === 0 ? undefined : `${missingIn(askRows).join(", ")} still needs words.`
  );

  const shown = $derived(
    templates.filter((item) =>
      item.name.toLocaleLowerCase().includes(state.query.trim().toLocaleLowerCase())
    )
  );

  const view$ = $derived(builderView(state.draft, offering));
  const busy = $derived(state.pending !== undefined || body === undefined);
  const scopeBlocked = $derived(
    state.draft.include.length === 0
      ? "Include something, or choose everything in the project."
      : undefined
  );
</script>

<Panel title="Templates">
  {#snippet actions()}
    {#if documentId !== undefined && stage !== undefined}
      <PanelButton label="Save" tone="primary" disabled={busy} title="Write this copy back to the template" onclick={() => state.save()} />
      <PanelButton label="Discard" tone="danger" disabled={busy} title="Remove this copy and close it" onclick={() => state.discard()} />
    {/if}
  {/snippet}

  {#if documentId === undefined}
    <PanelEmpty title="Open a document to work with templates" />
  {:else}
    {#if state.actionError}
      <PanelBanner title="That did not happen" tone="attention">{state.actionError}</PanelBanner>
    {/if}
    {#if state.notice.length > 0}
      <div class="notice">
        {#each state.notice as line (line)}
          <PanelNote>{line}</PanelNote>
        {/each}
      </div>
    {/if}

    {#if resourceQuery === undefined || !resourceQuery.ready}
      <PanelNote>Reading this document…</PanelNote>
    {:else if stage !== undefined}
      <div class="after-verbs">
        <PanelSection title="Holes" count={template?.holes.length} chevron="end">
          {#if template === undefined}
            <PanelNote>Reading the template…</PanelNote>
          {:else if template.holes.length === 0}
            <PanelNote>
              Nothing here is a hole yet. Select some text, or open a prompt, and press Templateify
              in its Template section.
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
                  onchange={(next) => state.changeHoles(withHoleField(template.holes, hole.name, { description: next }))}
                />
                {#if hole.kind === "text"}
                  <PanelEditableText
                    value={hole.text ?? ""}
                    label={`Default words for ${hole.label}`}
                    placeholder="What it says when nobody says otherwise"
                    multiline
                    disabled={busy}
                    onchange={(next) => state.changeHoles(withHoleField(template.holes, hole.name, { text: next }))}
                  />
                {:else}
                  <div class="scope">
                    <PanelButton
                      label="Default scope"
                      disabled={busy}
                      title={`${ruleOf(hole.default, setNames)} — change what ${hole.label} selects by default`}
                      onclick={() => state.openDefault(hole)}
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
        <PanelInput label="Template name" placeholder={title ?? "Template name"} flush bind:value={state.nameDraft} onenter={() => state.saveAs()} />
        <PanelButton label="Save" tone="primary" disabled={busy || state.nameDraft.trim() === ""} title={state.nameDraft.trim() === "" ? "Give the template a name first" : "Copy this document into a new template and open it"} onclick={() => state.saveAs()} />
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
        <PanelEmpty title="No document templates yet" action="Save this document as one to start" />
      {:else}
        <PanelSearch placeholder="Search templates…" matched={shown.length} flush bind:value={state.query}>
          {#each shown as item (item.id)}
            <div class="item">
              <PanelRow title={item.name}>
                <span class="item-title">{item.name}</span>
                <span class="item-sub">{item.holeCount} {item.holeCount === 1 ? "hole" : "holes"} · revision {item.revision}</span>
                <span class="item-actions">
                  <PanelButton label="Insert" tone="ghost" disabled={busy} title={`Insert “${item.name}” after the current row`} onclick={() => state.insert(item)} />
                  <PanelButton label="Edit" tone="ghost" disabled={busy} title={`Edit “${item.name}” in the editor`} onclick={() => state.edit(item)} />
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
  bind:open={state.insertOpen}
  title={`Insert “${state.insertFor?.name ?? "the template"}”`}
  description="One hole at a time. The tabs say which still need words."
  confirm="Insert"
  width="wide"
  blocked={askBlocked}
  onconfirm={() => state.confirmInsert()}
>
  <TemplateAnswerList
    rows={askRows}
    prompts={state.insertFor === undefined ? {} : promptWordsIn(state.insertFor.body)}
    onscope={(name) => state.openAnswer(name)}
    ontext={(name, words) => state.writeText(name, words)}
    onreset={(name) => state.clearAnswer(name)}
    onaccept={() => state.confirmInsert()}
  />
</OverlayModal>

<OverlayModal
  bind:open={state.answerOpen}
  title={`What ${state.answering?.label ?? "the hole"} selects here`}
  description="For this copy only. Nothing here changes the template."
  confirm="Use this"
  width="wide"
  blocked={scopeBlocked}
  onconfirm={() => state.confirmAnswer()}
  oncancel={() => state.cancelAnswer()}
>
  <ScopeBuilder
    {...view$}
    resettable
    onmode={(whole) => state.setMode(whole)}
    onadd={(side, source, key) => state.addTerm(side, source, key)}
    ondrop={(side, key) => state.dropTerm(side, key)}
    onclear={() => state.clearScope()}
    onreset={() => state.resetAnswering()}
  />
</OverlayModal>

<OverlayModal
  bind:open={state.defaultOpen}
  title={`Default scope for ${state.defaultFor?.label ?? "the hole"}`}
  description="What it selects until whoever places the template says otherwise."
  confirm="Set the default scope"
  width="wide"
  blocked={scopeBlocked}
  onconfirm={() => state.confirmDefault()}
>
  <ScopeBuilder
    {...view$}
    onmode={(whole) => state.setMode(whole)}
    onadd={(side, source, key) => state.addTerm(side, source, key)}
    ondrop={(side, key) => state.dropTerm(side, key)}
    onclear={() => state.clearScope()}
  />
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
