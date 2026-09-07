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
    PanelSection,
    PanelSelect,
    PanelToggle
  } from "$authored-components/panel";
  import { rowsIn } from "$app-views/categories/document-editor/procedures/store";
  import {
    DEFAULT_ANSWER,
    KINDS,
    answerOptions,
    answersFrom,
    commitStage,
    currentRowId,
    defaultChoices,
    detailIn,
    discardStage,
    documentTemplatesIn,
    insertionOf,
    isWholeProject,
    kindsOf,
    mergedVariables,
    namesOf,
    openStage,
    resourceSets,
    resourceTemplate,
    ruleFrom,
    ruleOf,
    saveAsTemplate,
    setIdsOf,
    setsIn,
    stageIn,
    templateDetail,
    templateLibrary,
    updateVariables,
    withVariableField,
    type TemplateAnswers,
    type TemplateDetail,
    type TemplateLibraryItem,
    type TemplateVariable
  } from "$app-views/categories/document-editor/procedures/templating";
  import { workspaceState } from "$model/client/workspace-state";
  import type { DocumentRuntime } from "$model/client/workspace-state";

  const view = workspaceState();
  let live = true;
  onDestroy(() => {
    live = false;
  });

  const documentId = $derived(view.active.resourceId);

  let runtime = $state<DocumentRuntime | undefined>(undefined);

  $effect(() => {
    runtime = documentId === undefined ? undefined : view.documentRuntime(documentId);
  });

  const body = $derived(runtime?.body);
  const title = $derived(rowsIn("documents").find((row) => row._id === documentId)?.title);

  const library = templateLibrary();
  const sets = resourceSets();
  const setItems = $derived(setsIn(sets.ready ? sets.current : undefined));
  const setNames = $derived(namesOf(setItems));
  const resourceQuery = $derived(documentId === undefined ? undefined : resourceTemplate(documentId));
  const resource = $derived(resourceQuery?.ready ? resourceQuery.current : undefined);
  const stage = $derived(stageIn(resource));
  const detailQuery = $derived(templateDetail(stage?.templateId));
  const template = $derived(detailIn(detailQuery?.ready ? detailQuery.current : undefined));
  const templates = $derived(documentTemplatesIn(library.ready ? library.current : undefined));
  const currentRevision = $derived(template?.revision ?? stage?.currentRevision ?? null);

  let query = $state("");
  let nameDraft = $state("");
  let pending = $state<string | undefined>(undefined);
  let actionError = $state<string | undefined>(undefined);
  let notice = $state<readonly string[]>([]);
  let defaultFor = $state<TemplateVariable | undefined>(undefined);
  let defaultOpen = $state(false);
  let draftWhole = $state(true);
  let draftKinds = $state<string[]>([]);
  let draftSets = $state<string[]>([]);
  let insertFor = $state<TemplateDetail | undefined>(undefined);
  let insertOpen = $state(false);
  let choices = $state<Record<string, string>>({});

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
    if (runtime.pending > 0 || runtime.failure !== undefined) {
      actionError = "The document has changes that are not saved yet. Save them first.";
      return false;
    }
    return true;
  };

  const save = () =>
    run("save", async () => {
      if (documentId === undefined || stage === undefined || currentRevision === null) return;
      if (!(await settled())) return;
      const result = await commitStage(
        view,
        { stageId: stage.stageId, templateId: stage.templateId, baseRevision: currentRevision },
        documentId
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
      if (documentId === undefined || stage === undefined) return;
      if (!confirm(`Discard the working copy of “${stage.templateName}”? Unsaved edits are lost.`)) return;
      if (!(await settled())) return;
      const tab = view.activeId;
      const result = await discardStage(view, { stageId: stage.stageId, templateId: stage.templateId }, documentId);
      if (!live) return;
      if (!result.accepted) {
        actionError = result.detail;
        return;
      }
      view.close(tab);
    });

  const saveAs = () =>
    run("save-as", async () => {
      const name = nameDraft.trim();
      if (documentId === undefined || name === "") return;
      const made = await saveAsTemplate(view, documentId, name);
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
        category: "document-editor",
        resourceId: opened.resourceId,
        context: "document-editor.templates"
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
        category: "document-editor",
        resourceId: result.resourceId,
        context: "document-editor.templates"
      });
    });

  const place = async (detail: TemplateDetail, answers: TemplateAnswers) => {
    if (body === undefined || runtime === undefined) return;
    const insertion = insertionOf(
      body,
      detail,
      currentRowId(body, view.selection),
      stage === undefined ? "resolve" : "keep",
      answers
    );
    if (insertion.ops.length === 0) {
      notice = ["That template has no content to insert."];
      return;
    }
    runtime.apply(insertion.ops);
    if (insertion.firstBlockId !== undefined) runtime.scrollTo = insertion.firstBlockId;
    if (stage !== undefined && template !== undefined) {
      const merged = mergedVariables(template.variables, detail.variables);
      if (merged.length !== template.variables.length) {
        const result = await updateVariables(view, template, merged, documentId);
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
      if (stage === undefined && detail.variables.length > 0) {
        insertFor = detail;
        choices = defaultChoices(detail.variables);
        insertOpen = true;
        return;
      }
      await place(detail, {});
    });

  const confirmInsert = () => {
    const detail = insertFor;
    if (detail === undefined) return;
    void run(`place:${detail.id}`, () => place(detail, answersFrom(choices)));
  };

  const changeVariables = (next: readonly TemplateVariable[]) =>
    run("variables", async () => {
      if (template === undefined) return;
      const result = await updateVariables(view, template, next, documentId);
      if (live && !result.accepted) actionError = result.detail;
    });

  const openDefault = (variable: TemplateVariable) => {
    defaultFor = variable;
    draftWhole = isWholeProject(variable.default);
    draftKinds = [...kindsOf(variable.default)];
    draftSets = [...setIdsOf(variable.default)];
    defaultOpen = true;
  };

  const toggleKind = (kind: string, on: boolean) => {
    draftKinds = on
      ? [...draftKinds.filter((held) => held !== kind), kind]
      : draftKinds.filter((held) => held !== kind);
  };

  const toggleSet = (setId: string, on: boolean) => {
    draftSets = on
      ? [...draftSets.filter((held) => held !== setId), setId]
      : draftSets.filter((held) => held !== setId);
  };

  const confirmDefault = () => {
    if (template === undefined || defaultFor === undefined) return;
    void changeVariables(
      withVariableField(template.variables, defaultFor.name, {
        default: ruleFrom(draftWhole, draftKinds, draftSets)
      })
    );
  };

  const busy = $derived(pending !== undefined || body === undefined);
  const defaultBlocked = $derived(
    !draftWhole && draftKinds.length === 0 && draftSets.length === 0
      ? "Pick everything, or at least one kind or set."
      : undefined
  );
</script>

<Panel title="Templates">
  {#snippet actions()}
    {#if documentId !== undefined && stage !== undefined}
      <PanelButton label="Save" tone="primary" disabled={busy} title="Write this copy back to the template" onclick={save} />
      <PanelButton label="Discard" tone="danger" disabled={busy} title="Remove this copy and close it" onclick={discard} />
    {/if}
  {/snippet}

  {#if documentId === undefined}
    <PanelEmpty title="Open a document to work with templates" />
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
      <PanelNote>Reading this document…</PanelNote>
    {:else if stage !== undefined}
      <div class="after-verbs">
        <PanelSection title="Variables" count={template?.variables.length} chevron="end">
          {#if template === undefined}
            <PanelNote>Reading the template…</PanelNote>
          {:else if template.variables.length === 0}
            <PanelNote>A variable appears when a prompt in this template asks for one. Nothing here does yet.</PanelNote>
          {:else}
            {#each template.variables as variable (variable.name)}
              <article class="variable">
                <header>
                  <PanelChip tone="accent-1">{variable.name}</PanelChip>
                  <span class="variable-label">{variable.label}</span>
                </header>
                <PanelEditableText
                  value={variable.description ?? ""}
                  label={`Description for ${variable.label}`}
                  placeholder="What this variable stands for"
                  multiline
                  disabled={busy}
                  onchange={(next) => changeVariables(withVariableField(template.variables, variable.name, { description: next }))}
                />
                <div class="scope">
                  <PanelButton
                    label="Default scope"
                    disabled={busy}
                    title={`${ruleOf(variable.default, setNames)} — change what ${variable.label} selects by default`}
                    onclick={() => openDefault(variable)}
                  />
                </div>
              </article>
            {/each}
          {/if}
        </PanelSection>
      </div>
    {:else}
      <div class="save">
        <PanelInput label="Template name" placeholder={title ?? "Template name"} flush bind:value={nameDraft} onenter={saveAs} />
        <PanelButton label="Save" tone="primary" disabled={busy || nameDraft.trim() === ""} title={nameDraft.trim() === "" ? "Give the template a name first" : "Copy this document into a new template and open it"} onclick={saveAs} />
      </div>
    {/if}

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
        <PanelSearch placeholder="Search templates…" matched={shown.length} flush bind:value={query}>
          {#each shown as item (item.id)}
            <div class="item">
              <PanelRow title={item.name}>
                <span class="item-title">{item.name}</span>
                <span class="item-sub">{item.variableCount} {item.variableCount === 1 ? "variable" : "variables"} · revision {item.revision}</span>
                <span class="item-actions">
                  <PanelButton label="Insert" tone="ghost" disabled={busy} title={`Insert “${item.name}” after the current row`} onclick={() => insert(item)} />
                  <PanelButton label="Edit" tone="ghost" disabled={busy} title={`Edit “${item.name}” in the editor`} onclick={() => edit(item)} />
                </span>
              </PanelRow>
            </div>
          {/each}
        </PanelSearch>
      {/if}
    </PanelSection>
  {/if}
</Panel>

<OverlayModal
  bind:open={insertOpen}
  title={`Insert “${insertFor?.name ?? "the template"}”`}
  description="What each variable selects in this document. The default is what the template suggests."
  confirm="Insert"
  width="narrow"
  onconfirm={confirmInsert}
>
  <div class="answers">
    {#each insertFor?.variables ?? [] as variable (variable.name)}
      <div class="answer">
        <span class="answer-label">{variable.label}</span>
        {#if variable.description}
          <span class="answer-help">{variable.description}</span>
        {/if}
        <PanelSelect
          label={`Answer for ${variable.label}`}
          value={choices[variable.name] ?? DEFAULT_ANSWER}
          options={answerOptions(variable, setItems)}
          onchange={(next) => (choices = { ...choices, [variable.name]: next })}
        />
      </div>
    {/each}
  </div>
</OverlayModal>

<OverlayModal
  bind:open={defaultOpen}
  title={`Default scope for ${defaultFor?.label ?? "the variable"}`}
  description="What the variable selects until whoever inserts the template says otherwise."
  confirm="Set the default scope"
  width="narrow"
  blocked={defaultBlocked}
  onconfirm={confirmDefault}
>
  <div class="choices">
    <label class="choice">
      <PanelToggle label="Everything in the project" checked={draftWhole} onchange={(on) => (draftWhole = on)} />
      <span>Everything in the project</span>
    </label>
    <p class="or">Or only these kinds</p>
    {#each KINDS as entry (entry.kind)}
      <label class="choice">
        <PanelToggle label={entry.label} checked={draftKinds.includes(entry.kind)} disabled={draftWhole} onchange={(on) => toggleKind(entry.kind, on)} />
        <span class:muted={draftWhole}>{entry.label}</span>
      </label>
    {/each}
    {#if setItems.length > 0}
      <p class="or">Or these sets</p>
      {#each setItems as set (set.id)}
        <label class="choice">
          <PanelToggle label={set.name} checked={draftSets.includes(set.id)} disabled={draftWhole} onchange={(on) => toggleSet(set.id, on)} />
          <span class:muted={draftWhole}>{set.name}</span>
        </label>
      {/each}
    {/if}
  </div>
</OverlayModal>

<style>
  .choices,
  .answers {
    display: flex;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 1.5);
    padding: 0 calc(var(--token-spacing-unit) * 3);
  }

  .answers {
    gap: calc(var(--token-spacing-unit) * 3);
  }

  .answer {
    display: flex;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 1);
  }

  .answer-label {
    color: var(--token-ink-primary);
    font-size: var(--token-text-body-sm);
    line-height: var(--token-text-body-sm-leading);
    font-weight: 600;
  }

  .answer-help {
    color: var(--token-ink-muted);
    font-size: var(--token-text-caption);
    line-height: var(--token-text-caption-leading);
  }

  .choice {
    display: flex;
    align-items: center;
    gap: calc(var(--token-spacing-unit) * 2);
    color: var(--token-ink-primary);
    font-size: var(--token-text-body-sm);
    line-height: var(--token-text-body-sm-leading);
  }

  .muted {
    color: var(--token-ink-muted);
  }

  .or {
    margin: calc(var(--token-spacing-unit) * 1) 0 0;
    color: var(--token-ink-muted);
    font-size: var(--token-text-caption);
    line-height: var(--token-text-caption-leading);
  }

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

  .variable {
    display: flex;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 1.5);
    padding: calc(var(--token-spacing-unit) * 2);
    border: 1px solid var(--token-border-subtle);
    border-radius: var(--token-radius-control);
    background: var(--token-surface-elevated);
  }

  .variable + .variable {
    margin-top: calc(var(--token-spacing-unit) * 1.5);
  }

  .variable header {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: calc(var(--token-spacing-unit) * 1.5);
  }

  .variable-label {
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
