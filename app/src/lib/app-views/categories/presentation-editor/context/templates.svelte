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
  import { TemplatesContextState } from "$app-views/categories/presentation-editor/context/templates.state.svelte";
  import { slideIndexOf } from "$app-views/categories/presentation-editor/procedures/presentation-slides";
  import {
    answerRowsOf,
    builderView,
    missingIn,
    presentationTemplatesIn,
    detailIn,
    offeringOf,
    promptWordsIn,
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
    withSlotField
  } from "$app-views/categories/presentation-editor/procedures/templating";
  import { releaseTemplatesContext } from "$app-views/categories/presentation-editor/procedures/effects/templates-context.svelte";
  import { workspaceState } from "$model/client/workspace-state";

  const view = workspaceState();
  const presentationId = view.active.resourceId;
  const runtime = presentationId === undefined ? undefined : view.presentationRuntime(presentationId);

  const body = $derived(runtime?.body);
  const current = $derived(body === undefined ? undefined : body.slides[slideIndexOf(body, view.active.focus ?? undefined)]);
  const position = $derived(body === undefined || current === undefined ? 0 : slideIndexOf(body, current.id) + 1);

  const library = templateLibrary();
  const sets = resourceSets();
  const index = projectResources();
  const title = $derived(index.current?.resources.find((row) => row.id === presentationId)?.name);
  const setItems = $derived(setsIn(sets.ready ? sets.current : undefined));
  const catalogue = $derived(resourcesIn(index.ready ? index.current : undefined));
  const setNames = $derived(scopeNamesOf(setItems, catalogue));
  const offering = $derived(offeringOf(setItems, catalogue));
  const resourceQuery = $derived(presentationId === undefined ? undefined : resourceTemplate(presentationId));
  const resource = $derived(resourceQuery?.ready ? resourceQuery.current : undefined);
  const stage = $derived(stageIn(resource));
  const detailQuery = $derived(templateDetail(stage?.templateId));
  const template = $derived(detailIn(detailQuery?.ready ? detailQuery.current : undefined));
  const templates = $derived(presentationTemplatesIn(library.ready ? library.current : undefined));
  const currentRevision = $derived(template?.revision ?? stage?.currentRevision ?? null);

  const state = new TemplatesContextState({
    view,
    presentationId: () => presentationId,
    runtime: () => runtime,
    body: () => body,
    currentSlideId: () => current?.id ?? null,
    stage: () => stage,
    template: () => template,
    currentRevision: () => currentRevision
  });
  releaseTemplatesContext(state);

  const askRows = $derived(
    answerRowsOf(state.insertFor?.slots ?? [], state.choices, state.texts, setNames)
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
  const unnamed = $derived(state.nameDraft.trim() === "");
  const scopeBlocked = $derived(
    state.draft.include.length === 0
      ? "Include something, or choose everything in the project."
      : undefined
  );
</script>

<Panel title="Templates">
  {#snippet actions()}
    {#if presentationId !== undefined && stage !== undefined}
      <PanelButton label="Save" tone="primary" disabled={busy} title="Write these slides back to the template" onclick={() => state.save()} />
      <PanelButton label="Discard" tone="danger" disabled={busy} title="Remove this copy and close it" onclick={() => state.discard()} />
    {/if}
  {/snippet}

  {#if presentationId === undefined}
    <PanelEmpty title="Open a presentation to work with templates" />
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
      <PanelNote>Reading this presentation…</PanelNote>
    {:else if stage !== undefined}
      <div class="after-verbs">
        <PanelSection title="Slots" count={template?.slots.length} chevron="end">
          {#if template === undefined}
            <PanelNote>Reading the template…</PanelNote>
          {:else if template.slots.length === 0}
            <PanelNote>
              Nothing here is a slot yet. Open a prompt and press Templateify in its Template section.
            </PanelNote>
          {:else}
            {#each template.slots as slot (slot.name)}
              <article class="slot">
                <header>
                  <PanelChip tone="accent-1">{slot.name}</PanelChip>
                  <span class="slot-label">{slot.label}</span>
                </header>
                <PanelEditableText
                  value={slot.description ?? ""}
                  label={`Description for ${slot.label}`}
                  placeholder="What this slot stands for"
                  multiline
                  disabled={busy}
                  onchange={(next) => state.changeSlots(withSlotField(template.slots, slot.name, { description: next }))}
                />
                {#if slot.kind === "text"}
                  <PanelEditableText
                    value={slot.text ?? ""}
                    label={`Default words for ${slot.label}`}
                    placeholder="What it says when nobody says otherwise"
                    multiline
                    disabled={busy}
                    onchange={(next) => state.changeSlots(withSlotField(template.slots, slot.name, { text: next }))}
                  />
                {:else}
                  <div class="scope">
                    <PanelButton
                      label="Default scope"
                      disabled={busy}
                      title={`${ruleOf(slot.default, setNames)} — change what ${slot.label} selects by default`}
                      onclick={() => state.openDefault(slot)}
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
        <div class="save-actions">
          <PanelButton label="Save presentation" tone="primary" disabled={busy || unnamed} title={unnamed ? "Give the template a name first" : "Copy the whole presentation into a new template and open it"} onclick={() => state.saveAs()} />
          <PanelButton label="Save slide" disabled={busy || unnamed || current === undefined} title={unnamed ? "Give the template a name first" : `Copy slide ${position} into a new template and open it`} onclick={() => state.saveAs(current?.id)} />
        </div>
      </div>
    {/if}

    <div class="after-slots">
    <PanelSection title="List" chevron="end" flush>
      {#if library.error}
        <PanelBanner title="Templates unavailable" tone="danger">
          {library.error instanceof Error ? library.error.message : String(library.error)}
        </PanelBanner>
      {:else if !library.ready}
        <PanelNote>Reading the library…</PanelNote>
      {:else if templates.length === 0}
        <PanelEmpty title="No presentation templates yet" action="Save this presentation or a slide as one to start" />
      {:else}
        <PanelSearch placeholder="Search templates…" matched={shown.length} flush bind:value={state.query}>
          {#each shown as item (item.id)}
            <div class="item">
              <PanelRow title={item.name}>
                <span class="item-title">{item.name}</span>
                <span class="item-sub">{item.slotCount} {item.slotCount === 1 ? "slot" : "slots"} · revision {item.revision}</span>
                <span class="item-actions">
                  <PanelButton label="Insert" tone="ghost" disabled={busy} title={`Insert “${item.name}” after slide ${position}`} onclick={() => state.insert(item)} />
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
  description="One slot at a time. The tabs say which still need words."
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
  title={`What ${state.answering?.label ?? "the slot"} selects here`}
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
  title={`Default scope for ${state.defaultFor?.label ?? "the slot"}`}
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

  .save-actions {
    display: flex;
    gap: calc(var(--token-spacing-unit) * 1);
  }

  .after-verbs {
    margin-top: calc(var(--token-spacing-unit) * 2);
    padding-top: calc(var(--token-spacing-unit) * 1);
    border-top: 1px solid var(--token-border-subtle);
  }

  .after-slots {
    margin-top: calc(var(--token-spacing-unit) * 2);
    padding-top: calc(var(--token-spacing-unit) * 1);
    border-top: 1px solid var(--token-border-subtle);
  }

  .slot {
    display: flex;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 1.5);
    padding: calc(var(--token-spacing-unit) * 2);
    border: 1px solid var(--token-border-subtle);
    border-radius: var(--token-radius-control);
    background: var(--token-surface-elevated);
  }

  .slot + .slot {
    margin-top: calc(var(--token-spacing-unit) * 1.5);
  }

  .slot header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: calc(var(--token-spacing-unit) * 1.5);
  }

  .slot-label {
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
