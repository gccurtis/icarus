<script lang="ts">
  import { onDestroy, onMount, tick } from "svelte";
  import Braces from "@lucide/svelte/icons/braces";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import Copy from "@lucide/svelte/icons/copy";
  import ExternalLink from "@lucide/svelte/icons/external-link";
  import FilePenLine from "@lucide/svelte/icons/file-pen-line";
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";
  import X from "@lucide/svelte/icons/x";

  import { OverlayModal } from "$authored-components/overlay";
  import {
    Panel,
    PanelBanner,
    PanelChip,
    PanelEmpty,
    PanelSkeleton
  } from "$authored-components/panel";
  import { ScopeBuilder } from "$authored-components/scope-builder";
  import { TemplateAnswers as TemplateAnswerList } from "$authored-components/template-answers";
  import { Button } from "$vendored-components/button";
  import { Input } from "$vendored-components/input";
  import { Textarea } from "$vendored-components/textarea";
  import {
    EDITOR_CATEGORY,
    answerRowsOf,
    answersFrom,
    builderView,
    missingIn,
    wordsFrom,
    detailIn,
    draftOf,
    duplicateTemplate,
    editTemplate,
    emptyTemplateInspectorTitle,
    inspectTemplate,
    instantiateTemplate,
    offeringOf,
    projectResources,
    removeTemplate,
    resourceSets,
    resourcesIn,
    ruleOf,
    scopeNamesOf,
    selectedTemplateIdIn,
    setsIn,
    templateDetail,
    templateLibrary,
    termFor,
    unavailableTemplateIn,
    updateTemplateDescription,
    updateTemplateName,
    updateTemplateTags,
    updateTemplateVariableDefault,
    updateTemplateVariableDescription,
    withTerm,
    withWholeProject,
    withoutTerm,
    type LibraryTemplateDetail,
    type OfferSource,
    type ScopeDraft,
    type ScopeSide,
    type TemplateAnswers,
    type TemplateVariable
  } from "$app-views/categories/templates/procedures/library.svelte";
  import { workspaceState } from "$model/client/workspace-state";

  const view = workspaceState();
  const selectedId = $derived(
    view.selection?.kind === "template" ? view.selection.id : undefined
  );
  const library = templateLibrary();
  const sets = resourceSets();
  const index = projectResources();
  const setItems = $derived(setsIn(sets.ready ? sets.current : undefined));
  const catalogue = $derived(resourcesIn(index.ready ? index.current : undefined));
  const setNames = $derived(scopeNamesOf(setItems, catalogue));
  const offering = $derived(offeringOf(setItems, catalogue));
  const availableTemplateIds = $derived(
    library.ready ? library.current.templates.map((row) => row.id) : []
  );
  const readableTemplateId = $derived(
    selectedTemplateIdIn(selectedId, availableTemplateIds)
  );
  const detail = $derived(templateDetail(readableTemplateId));
  const detailAnswer = $derived(
    detail !== undefined && detail.ready ? detail.current : undefined
  );
  const emptyTitle = $derived(
    emptyTemplateInspectorTitle(library.ready ? library.current.templates.length : undefined)
  );
  let now = $state(Date.now());
  onMount(() => {
    const timer = setInterval(() => (now = Date.now()), 60_000);
    return () => clearInterval(timer);
  });
  const template = $derived(detailIn(detailAnswer, now));
  const unavailable = $derived(unavailableTemplateIn(detailAnswer));
  let defaultFor = $state<TemplateVariable | undefined>(undefined);
  let defaultOpen = $state(false);
  let draft = $state<ScopeDraft>(draftOf(undefined));
  let useOpen = $state(false);
  let answerOpen = $state(false);
  let useChoices = $state<Record<string, ScopeDraft | undefined>>({});
  let useTexts = $state<Record<string, string | undefined>>({});
  let answering = $state<TemplateVariable | undefined>(undefined);

  const askRows = $derived(answerRowsOf(template?.variables ?? [], useChoices, useTexts, setNames));
  const askBlocked = $derived(
    missingIn(askRows).length === 0 ? undefined : `${missingIn(askRows).join(", ")} still needs words.`
  );
  const scopeBlocked = $derived(
    draft.include.length === 0 ? "Include something, or choose everything in the project." : undefined
  );

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

  let editingDescription = $state(false);
  let descriptionDraft = $state("");
  let descriptionBase = $state<LibraryTemplateDetail>();
  let editingName = $state(false);
  let nameDraft = $state("");
  let nameBase = $state<LibraryTemplateDetail>();
  let nameEditor = $state<HTMLInputElement | null>(null);
  let descriptionEditor = $state<HTMLTextAreaElement | null>(null);
  let nameTrigger = $state<HTMLButtonElement | null>(null);
  let descriptionTrigger = $state<HTMLButtonElement | null>(null);
  let editingVariable = $state<string>();
  let variableDescriptionDraft = $state("");
  let variableBase = $state<LibraryTemplateDetail>();
  let variableEditor = $state<HTMLTextAreaElement | null>(null);
  let tagEditor = $state<HTMLInputElement | null>(null);
  let tagDraft = $state("");
  let activeTemplateId = $state<string>();
  let pending = $state<
    "name" | "description" | "variable" | "tag" | "duplicate" | "delete" | "use" | "edit" | "default"
  >();
  let actionError = $state<string>();
  let live = true;
  onDestroy(() => {
    live = false;
  });

  const SPREADSHEET_HANDOFF =
    "Spreadsheet templates are represented and can be materialized, but Use is paused until the spreadsheet editor consumes the created resource id.";

  $effect(() => {
    if (template?.id === activeTemplateId) return;
    activeTemplateId = template?.id;
    nameDraft = template?.name ?? "";
    nameBase = undefined;
    editingName = false;
    descriptionDraft = template?.description ?? "";
    descriptionBase = undefined;
    tagDraft = "";
    editingDescription = false;
    editingVariable = undefined;
    variableDescriptionDraft = "";
    variableBase = undefined;
    actionError = undefined;
  });

  const stillInspecting = (tabId: string, subjectId: string): boolean =>
    live &&
    view.activeId === tabId &&
    view.selection?.kind === "template" &&
    view.selection.id === subjectId;

  const fail = (error: unknown, tabId: string, subjectId: string) => {
    if (stillInspecting(tabId, subjectId)) {
      actionError = error instanceof Error ? error.message : String(error);
    }
  };

  const startDescription = async () => {
    if (template === undefined || !template.canEdit || pending !== undefined) return;
    editingName = false;
    nameBase = undefined;
    editingVariable = undefined;
    variableBase = undefined;
    descriptionBase = template;
    descriptionDraft = template.description;
    editingDescription = true;
    await tick();
    descriptionEditor?.focus();
    descriptionEditor?.select();
  };

  const startName = async () => {
    if (template === undefined || !template.canEdit || pending !== undefined) return;
    editingDescription = false;
    descriptionBase = undefined;
    editingVariable = undefined;
    variableBase = undefined;
    nameBase = template;
    nameDraft = template.name;
    editingName = true;
    await tick();
    nameEditor?.focus();
    nameEditor?.select();
  };

  const focusNameTrigger = async () => {
    await tick();
    nameTrigger?.focus();
  };

  const focusDescriptionTrigger = async () => {
    await tick();
    descriptionTrigger?.focus();
  };

  const commitName = async (returnFocus = false) => {
    const subject = nameBase;
    const originTabId = view.activeId;
    const name = nameDraft.trim();
    if (
      subject === undefined ||
      template?.id !== subject.id ||
      !subject.canEdit ||
      pending !== undefined
    ) {
      return;
    }
    if (name === "") {
      actionError = "A template name is required.";
      nameDraft = subject.name;
      editingName = false;
      nameBase = undefined;
      if (returnFocus) await focusNameTrigger();
      return;
    }
    if (name === subject.name) {
      editingName = false;
      nameBase = undefined;
      if (returnFocus) await focusNameTrigger();
      return;
    }

    pending = "name";
    actionError = undefined;
    let restoreFocus = false;
    try {
      const result = await updateTemplateName(view, subject, name);
      if (!stillInspecting(originTabId, subject.id)) return;
      if (!result.accepted) {
        actionError = result.detail;
        if (result.reason === "stale") {
          editingName = false;
          nameBase = undefined;
          restoreFocus = true;
        }
      } else {
        editingName = false;
        nameBase = undefined;
        restoreFocus = true;
      }
    } catch (error) {
      fail(error, originTabId, subject.id);
    } finally {
      pending = undefined;
      if (restoreFocus && returnFocus) await focusNameTrigger();
    }
  };

  const cancelName = async () => {
    nameDraft = template?.name ?? "";
    nameBase = undefined;
    editingName = false;
    await focusNameTrigger();
  };

  const nameKeydown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      void cancelName();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      void commitName(true);
    }
  };

  const commitDescription = async (returnFocus = false) => {
    const subject = descriptionBase;
    const originTabId = view.activeId;
    if (
      subject === undefined ||
      template?.id !== subject.id ||
      !subject.canEdit ||
      pending !== undefined
    ) {
      return;
    }
    if (descriptionDraft.trim() === subject.description.trim()) {
      editingDescription = false;
      descriptionBase = undefined;
      if (returnFocus) await focusDescriptionTrigger();
      return;
    }

    pending = "description";
    actionError = undefined;
    let restoreFocus = false;
    try {
      const result = await updateTemplateDescription(view, subject, descriptionDraft);
      if (!stillInspecting(originTabId, subject.id)) return;
      if (!result.accepted) {
        actionError = result.detail;
        if (result.reason === "stale") {
          editingDescription = false;
          descriptionBase = undefined;
          restoreFocus = true;
        }
      } else {
        editingDescription = false;
        descriptionBase = undefined;
        restoreFocus = true;
      }
    } catch (error) {
      fail(error, originTabId, subject.id);
    } finally {
      pending = undefined;
      if (restoreFocus && returnFocus) await focusDescriptionTrigger();
    }
  };

  const cancelDescription = async () => {
    descriptionDraft = template?.description ?? "";
    descriptionBase = undefined;
    editingDescription = false;
    await focusDescriptionTrigger();
  };

  const descriptionKeydown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      void cancelDescription();
      return;
    }
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      void commitDescription(true);
    }
  };

  const startVariableDescription = async (variable: TemplateVariable) => {
    if (template === undefined || !template.canEdit || pending !== undefined) return;
    editingName = false;
    nameBase = undefined;
    editingDescription = false;
    descriptionBase = undefined;
    variableBase = template;
    editingVariable = variable.name;
    variableDescriptionDraft = variable.description ?? "";
    await tick();
    variableEditor?.focus();
    variableEditor?.select();
  };

  const cancelVariableDescription = () => {
    editingVariable = undefined;
    variableDescriptionDraft = "";
    variableBase = undefined;
  };

  const commitVariableDescription = async (variable: TemplateVariable) => {
    const subject = variableBase;
    const originTabId = view.activeId;
    if (
      subject === undefined ||
      template?.id !== subject.id ||
      editingVariable !== variable.name ||
      !subject.canEdit ||
      pending !== undefined
    ) {
      return;
    }
    if (variableDescriptionDraft.trim() === (variable.description ?? "").trim()) {
      cancelVariableDescription();
      return;
    }

    pending = "variable";
    actionError = undefined;
    try {
      const result = await updateTemplateVariableDescription(
        view,
        subject,
        variable.name,
        variableDescriptionDraft
      );
      if (!stillInspecting(originTabId, subject.id)) return;
      if (!result.accepted) actionError = result.detail;
      else cancelVariableDescription();
    } catch (error) {
      fail(error, originTabId, subject.id);
    } finally {
      pending = undefined;
    }
  };

  const variableKeydown = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    cancelVariableDescription();
  };

  const addTag = async () => {
    if (template === undefined || !template.canEdit || pending !== undefined) return;
    const subject = template;
    const originTabId = view.activeId;

    const value = tagDraft.trim();
    if (
      value === "" ||
      subject.tags.some((candidate) => candidate.toLocaleLowerCase() === value.toLocaleLowerCase())
    ) {
      return;
    }

    pending = "tag";
    actionError = undefined;
    try {
      const result = await updateTemplateTags(view, subject, [...subject.tags, value]);
      if (!stillInspecting(originTabId, subject.id)) return;
      if (!result.accepted) actionError = result.detail;
      else tagDraft = "";
    } catch (error) {
      fail(error, originTabId, subject.id);
    } finally {
      pending = undefined;
    }
  };

  const removeTag = async (tag: string) => {
    if (template === undefined || !template.canEdit || pending !== undefined) return;
    const subject = template;
    const originTabId = view.activeId;

    pending = "tag";
    actionError = undefined;
    let restoreFocus = false;
    try {
      const result = await updateTemplateTags(
        view,
        subject,
        subject.tags.filter((candidate) => candidate !== tag)
      );
      if (!stillInspecting(originTabId, subject.id)) return;
      if (!result.accepted) actionError = result.detail;
      else restoreFocus = true;
    } catch (error) {
      fail(error, originTabId, subject.id);
    } finally {
      pending = undefined;
      if (restoreFocus) {
        await tick();
        tagEditor?.focus();
      }
    }
  };

  const duplicate = async () => {
    if (template === undefined || pending !== undefined) return;
    const subject = template;
    const originTabId = view.activeId;

    pending = "duplicate";
    actionError = undefined;
    try {
      const result = await duplicateTemplate(view, subject);
      if (!stillInspecting(originTabId, subject.id)) return;
      if (!result.accepted) actionError = result.detail;
      else inspectTemplate(view, result.templateId);
    } catch (error) {
      fail(error, originTabId, subject.id);
    } finally {
      pending = undefined;
    }
  };

  const remove = async () => {
    if (template === undefined || !template.canDelete || pending !== undefined) return;
    const subject = template;
    const originTabId = view.activeId;
    if (!confirm(`Delete “${subject.name}”?`)) return;

    pending = "delete";
    actionError = undefined;
    try {
      const result = await removeTemplate(view, subject);
      if (!stillInspecting(originTabId, subject.id)) return;
      if (!result.accepted) actionError = result.detail;
      else view.clear();
    } catch (error) {
      fail(error, originTabId, subject.id);
    } finally {
      pending = undefined;
    }
  };

  const use = () => {
    if (template === undefined || pending !== undefined) return;
    if (template.makes === "Spreadsheet") {
      actionError = SPREADSHEET_HANDOFF;
      return;
    }
    if (template.variables.length === 0) {
      void instantiate({});
      return;
    }
    useChoices = {};
    useTexts = {};
    answering = undefined;
    useOpen = true;
  };

  const confirmUse = () => void instantiate(answersFrom(useChoices), wordsFrom(useTexts));

  /**
   * The builder is its own modal rather than a second face of the ask modal.
   * Swapping one modal's title, body and confirm while it is open replaces the
   * footer under the pointer, and the press lands on a button that has gone.
   */
  const openAnswer = (name: string) => {
    const variable = template?.variables.find((candidate) => candidate.name === name);
    if (variable === undefined) return;
    answering = variable;
    draft = draftOf(useChoices[name] ?? variable.default);
    useOpen = false;
    answerOpen = true;
  };

  const confirmAnswer = () => {
    if (answering !== undefined) useChoices = { ...useChoices, [answering.name]: draft };
    answering = undefined;
    answerOpen = false;
    useOpen = true;
  };

  const cancelAnswer = () => {
    answering = undefined;
    useOpen = true;
  };

  /** Inside the ask, Default means the template's own suggestion, not the floor. */
  const resetAnswering = () => {
    if (answering !== undefined) clearAnswer(answering.name);
    answering = undefined;
    answerOpen = false;
    useOpen = true;
  };

  const writeText = (name: string, words: string) => {
    useTexts = { ...useTexts, [name]: words };
  };

  const clearAnswer = (name: string) => {
    const { [name]: _chosen, ...restChoices } = useChoices;
    const { [name]: _typed, ...restTexts } = useTexts;
    useChoices = restChoices;
    useTexts = restTexts;
  };

  const instantiate = async (
    answers: TemplateAnswers,
    words: Readonly<Record<string, string>> = {}
  ) => {
    if (template === undefined || pending !== undefined) return;
    const subject = template;
    const originTabId = view.activeId;

    pending = "use";
    actionError = undefined;
    try {
      const result = await instantiateTemplate(view, subject, answers, words);
      if (!stillInspecting(originTabId, subject.id)) return;
      if (!result.accepted) {
        actionError = result.detail;
        return;
      }

      if (result.target === "spreadsheet") {
        actionError = SPREADSHEET_HANDOFF;
        return;
      }
      view.open({ category: EDITOR_CATEGORY[result.target], resourceId: result.resourceId });
    } catch (error) {
      fail(error, originTabId, subject.id);
    } finally {
      pending = undefined;
    }
  };

  const edit = async () => {
    if (template === undefined || pending !== undefined) return;
    const subject = template;
    const originTabId = view.activeId;
    if (subject.makes === "Spreadsheet") {
      actionError = "Spreadsheet templates open for editing once the spreadsheet editor lands.";
      return;
    }

    pending = "edit";
    actionError = undefined;
    try {
      const result = await editTemplate(view, subject);
      if (!live) return;
      if (!result.accepted) actionError = result.detail;
    } catch (error) {
      fail(error, originTabId, subject.id);
    } finally {
      pending = undefined;
    }
  };

  const openDefault = (variable: TemplateVariable) => {
    if (template === undefined || !template.canEdit || pending !== undefined) return;
    defaultFor = variable;
    draft = draftOf(variable.default);
    defaultOpen = true;
  };

  const setDefault = async () => {
    const variable = defaultFor;
    if (template === undefined || variable === undefined || pending !== undefined) return;
    const subject = template;
    const originTabId = view.activeId;
    const rule = draft;

    pending = "default";
    actionError = undefined;
    try {
      const result = await updateTemplateVariableDefault(view, subject, variable.name, rule);
      if (!stillInspecting(originTabId, subject.id)) return;
      if (!result.accepted) actionError = result.detail;
    } catch (error) {
      fail(error, originTabId, subject.id);
    } finally {
      pending = undefined;
    }
  };
</script>

{#snippet inspectorHeading()}
  <h2 class="inspector-heading">
    {#if editingName}
      <Input
        bind:ref={nameEditor}
        class="name-editor"
        bind:value={nameDraft}
        aria-label="Template name"
        maxlength={160}
        onkeydown={nameKeydown}
        onblur={() => commitName()}
      />
    {:else if template?.canEdit}
      <button
        bind:this={nameTrigger}
        type="button"
        class="name-trigger"
        title="Double-click to edit the template name"
        aria-label={`Edit template name: ${template.name}`}
        ondblclick={startName}
        onkeydown={(event) => {
          if (event.key === "Enter" || event.key === " ") startName();
        }}
      >{template.name}</button>
    {:else}
      <span>{template?.name ?? "Template"}</span>
    {/if}
  </h2>
{/snippet}

<Panel title={template?.name ?? "Template"} heading={inspectorHeading}>
  {#if readableTemplateId === undefined}
    <PanelEmpty title={emptyTitle} />
  {:else if detail === undefined}
    <PanelEmpty title={emptyTitle} />
  {:else if detail.error}
    <PanelBanner title="Template unavailable" tone="danger">
      {detail.error instanceof Error ? detail.error.message : String(detail.error)}
    </PanelBanner>
  {:else if !detail.ready}
    <PanelSkeleton shape="fields" count={6} />
  {:else if unavailable}
    <PanelBanner title="Template data unavailable" tone="danger">
      This stored template is invalid and has been quarantined from use. {unavailable.detail}
    </PanelBanner>
  {:else if template}
    <div class="inspector-stack">
      {#if actionError}
        <PanelBanner title="The template did not change" tone="attention">
          {actionError}
        </PanelBanner>
      {/if}

      <div class="identity">
        <p class="meta-line">
          <span>{template.scope}</span>
          <span aria-hidden="true">·</span>
          <span>{template.makes}</span>
          <span aria-hidden="true">·</span>
          <span>Updated {template.updated}</span>
        </p>
        <p class="byline">Created by {template.createdBy}</p>

      </div>

      <div class="divider" aria-hidden="true"></div>

      <section aria-labelledby="description-heading">
        <h3 id="description-heading" class="section-heading compact">Description</h3>
        {#if editingDescription}
          <Textarea
            bind:ref={descriptionEditor}
            class="description-editor"
            bind:value={descriptionDraft}
            aria-label="Template description"
            rows={3}
            onkeydown={descriptionKeydown}
            onblur={() => commitDescription()}
          />
        {:else if template.canEdit}
          <button
            bind:this={descriptionTrigger}
            type="button"
            class="description"
            aria-label="Edit template description"
            title="Double-click to edit description"
            ondblclick={startDescription}
            onkeydown={(event) => {
              if (event.key === "Enter" || event.key === " ") startDescription();
            }}
          >{template.description || "Add a description"}</button>
        {:else}
          <p class="description readonly">{template.description || "No description"}</p>
        {/if}
      </section>

      <div class="template-actions" role="toolbar" aria-label="Template actions">
        <Button
          variant="ghost"
          size="icon-sm"
          class="template-action use-action"
          aria-label={pending === "use" ? "Creating from template" : "Use template"}
          disabled={pending !== undefined || template.makes === "Spreadsheet"}
          title={template.makes === "Spreadsheet"
            ? SPREADSHEET_HANDOFF
            : "Use template — create an independent project resource"}
          onclick={use}
        ><ExternalLink aria-hidden="true" /></Button>
        <Button
          variant="ghost"
          size="icon-sm"
          class="template-action"
          aria-label={pending === "edit" ? "Opening template" : "Edit template"}
          disabled={pending !== undefined || template.makes === "Spreadsheet"}
          title={template.makes === "Spreadsheet"
            ? "Spreadsheet templates open for editing once the spreadsheet editor lands"
            : "Edit template — open a copy in its editor"}
          onclick={edit}
        ><FilePenLine aria-hidden="true" /></Button>
        <Button
          variant="ghost"
          size="icon-sm"
          class="template-action"
          aria-label={pending === "duplicate" ? "Duplicating template" : "Duplicate template"}
          title="Duplicate template"
          disabled={pending !== undefined}
          onclick={duplicate}
        ><Copy aria-hidden="true" /></Button>
        <Button
          variant="ghost"
          size="icon-sm"
          class="template-action delete-action"
          aria-label={pending === "delete" ? "Deleting template" : "Delete template"}
          disabled={!template.canDelete || pending !== undefined}
          title={template.canDelete ? "Delete template" : "Duplicate it to make an editable copy"}
          onclick={remove}
        ><Trash2 aria-hidden="true" /></Button>
      </div>

      {#if !template.canEdit}
        <p class="permission-note">Duplicate this template to edit its name, description, variables, or tags.</p>
      {/if}
      {#if template.makes === "Spreadsheet"}
        <p class="permission-note">{SPREADSHEET_HANDOFF}</p>
      {/if}

      <div class="divider" aria-hidden="true"></div>

      <section aria-labelledby="variables-heading">
        <h3 id="variables-heading" class="section-heading">
          Variables <span>{template.variables.length}</span>
        </h3>

        {#if template.variables.length === 0}
          <PanelEmpty title="This template asks for no variables." flush />
        {:else}
          <div class="variable-list">
            {#each template.variables as variable (variable.id)}
              <details class="variable">
                <summary>
                  <span class="variable-name">
                    <Braces size={13} aria-hidden="true" />
                    {variable.label}
                  </span>
                  <ChevronDown class="disclosure-icon" size={13} aria-hidden="true" />
                </summary>
                <div class="variable-body">
                  {#if editingVariable === variable.name}
                    <Textarea
                      bind:ref={variableEditor}
                      class="variable-description-editor"
                      bind:value={variableDescriptionDraft}
                      aria-label={`Description for ${variable.label}`}
                      rows={3}
                      onkeydown={variableKeydown}
                      onblur={() => commitVariableDescription(variable)}
                    />
                  {:else if template.canEdit}
                    <button
                      type="button"
                      class="variable-description"
                      title="Double-click to edit this description"
                      aria-label={`Edit description for ${variable.label}`}
                      ondblclick={() => startVariableDescription(variable)}
                      onkeydown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          startVariableDescription(variable);
                        }
                      }}
                    >{variable.description ?? "Add a description"}</button>
                  {:else}
                    <p>{variable.description ?? "No description supplied."}</p>
                  {/if}
                  <div class="variable-default">
                    {#if template.canEdit}
                      <Button
                        variant="outline"
                        size="xs"
                        title={`${ruleOf(variable.default, setNames)} — change what ${variable.label} selects by default`}
                        disabled={pending !== undefined}
                        onclick={() => openDefault(variable)}
                      >Default scope</Button>
                    {:else}
                      <span>{ruleOf(variable.default, setNames)}</span>
                    {/if}
                  </div>
                </div>
              </details>
            {/each}
          </div>
        {/if}
      </section>

      <div class="divider" aria-hidden="true"></div>

      <section aria-labelledby="tags-heading">
        <h3 id="tags-heading" class="section-heading">
          Tags <span>{template.tags.length}</span>
        </h3>

        {#if template.canEdit}
          <form
            class="tag-form"
            onsubmit={(event) => {
              event.preventDefault();
              addTag();
            }}
          >
            <Input
              bind:ref={tagEditor}
              class="tag-input"
              bind:value={tagDraft}
              aria-label="New tag"
              placeholder="Add a tag"
              disabled={pending !== undefined}
            />
            <Button
              variant="outline"
              size="icon-sm"
              class="border-border-subtle bg-surface-panel hover:bg-surface-panel-hover dark:bg-surface-panel dark:hover:bg-surface-panel-hover"
              aria-label="Add tag"
              title="Add tag"
              disabled={tagDraft.trim() === "" || pending !== undefined}
              type="submit"
            >
              <Plus aria-hidden="true" />
            </Button>
          </form>
        {/if}

        {#if template.tags.length > 0}
          <div class="tag-list">
            {#each template.tags as tag (tag)}
              {#if template.canEdit}
                <span class="tag-token">
                  <PanelChip>{tag}</PanelChip>
                  <button
                    type="button"
                    class="remove-tag"
                    aria-label={`Remove tag ${tag}`}
                    title={`Remove ${tag}`}
                    disabled={pending !== undefined}
                    onclick={() => removeTag(tag)}
                  >
                    <X size={11} aria-hidden="true" />
                  </button>
                </span>
              {:else}
                <PanelChip>{tag}</PanelChip>
              {/if}
            {/each}
          </div>
        {/if}

      </section>
    </div>
  {:else}
    <PanelEmpty title="That template is not in this library." />
  {/if}
</Panel>

<OverlayModal
  bind:open={useOpen}
  title={`Use “${template?.name ?? "the template"}”`}
  description="Every parameter this template asks for. Open one to read what it means."
  confirm="Create"
  width="narrow"
  blocked={askBlocked}
  onconfirm={confirmUse}
>
  <TemplateAnswerList
    rows={askRows}
    onscope={openAnswer}
    ontext={writeText}
    onreset={clearAnswer}
  />
</OverlayModal>

<OverlayModal
  bind:open={answerOpen}
  title={`What ${answering?.label ?? "the parameter"} selects here`}
  description="For the new resource only. Nothing here changes the template."
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
    onreset={resetAnswering}
  />
</OverlayModal>

<OverlayModal
  bind:open={defaultOpen}
  title={`Default scope for ${defaultFor?.label ?? "the parameter"}`}
  description="What it selects until whoever places the template says otherwise."
  confirm="Set the default scope"
  width="wide"
  blocked={scopeBlocked}
  onconfirm={() => void setDefault()}
>
  <ScopeBuilder {...view$} onmode={setMode} onadd={addTerm} ondrop={dropTerm} />
</OverlayModal>

<style>

  .inspector-stack {
    display: flex;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 3);
    padding: 0 calc(var(--token-spacing-unit) * 3);
  }

  .identity {
    display: flex;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 1.5);
  }

  .meta-line,
  .byline,
  .description,
  .variable-body {
    font-size: var(--token-text-caption);
    line-height: var(--token-text-caption-leading);
  }

  .meta-line,
  .byline {
    display: flex;
    flex-wrap: wrap;
    gap: 0 calc(var(--token-spacing-unit) * 1);
    margin: 0;
    color: var(--token-ink-muted);
  }

  .byline {
    display: block;
  }

  .inspector-heading {
    min-width: 0;
    margin: 0;
    color: var(--token-ink-secondary);
    font-size: var(--token-text-body-sm);
    line-height: var(--token-text-body-sm-leading);
    font-weight: 600;
  }

  .name-trigger {
    display: block;
    overflow: hidden;
    width: 100%;
    padding: 0;
    border: 0;
    background: transparent;
    color: inherit;
    cursor: text;
    font: inherit;
    text-align: left;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .name-trigger:hover {
    color: var(--token-ink-primary);
  }

  .name-trigger:focus-visible {
    border-radius: var(--token-radius-control);
    outline: 2px solid var(--token-color-interactive-border);
    outline-offset: 2px;
  }

  .description {
    position: relative;
    display: block;
    overflow-y: auto;
    width: 100%;
    height: calc(var(--token-spacing-unit) * 20);
    margin: 0;
    padding: calc(var(--token-spacing-unit) * 2);
    border: 1px solid var(--token-border-subtle);
    border-radius: var(--token-radius-control);
    background: var(--token-surface-panel);
    background-image: linear-gradient(
      135deg,
      transparent 0 55%,
      var(--token-border-strong) 56% 66%,
      transparent 67% 76%,
      var(--token-border-strong) 77% 87%,
      transparent 88%
    );
    background-repeat: no-repeat;
    background-position: right calc(var(--token-spacing-unit) * 1) bottom calc(var(--token-spacing-unit) * 1);
    background-size: calc(var(--token-spacing-unit) * 2) calc(var(--token-spacing-unit) * 2);
    color: var(--token-ink-secondary);
    cursor: text;
    text-align: left;
    scrollbar-width: thin;
  }

  .description:hover {
    border-color: var(--token-border-strong);
  }

  .description.readonly {
    border-color: var(--token-border-subtle);
    background: var(--token-surface-panel);
    cursor: default;
  }

  .description:focus-visible {
    border-color: var(--token-color-interactive-border);
    outline: 2px solid var(--token-color-interactive-surface);
    outline-offset: 1px;
  }

  :global(.description-editor) {
    height: calc(var(--token-spacing-unit) * 20);
    min-height: calc(var(--token-spacing-unit) * 20);
    max-height: calc(var(--token-spacing-unit) * 20);
    resize: none;
    overflow-y: auto;
    border-color: var(--token-border-subtle);
    background: var(--token-surface-canvas);
    background-image: linear-gradient(
      135deg,
      transparent 0 55%,
      var(--token-border-strong) 56% 66%,
      transparent 67% 76%,
      var(--token-border-strong) 77% 87%,
      transparent 88%
    );
    background-repeat: no-repeat;
    background-position: right calc(var(--token-spacing-unit) * 1) bottom calc(var(--token-spacing-unit) * 1);
    background-size: calc(var(--token-spacing-unit) * 2) calc(var(--token-spacing-unit) * 2);
    color: var(--token-ink-secondary);
    font-size: var(--token-text-caption);
    line-height: var(--token-text-caption-leading);
  }

  :global(.name-editor) {
    width: 100%;
    height: calc(var(--token-spacing-unit) * 7);
    border-color: var(--token-border-subtle);
    background: var(--token-surface-canvas);
    font-size: var(--token-text-body-sm);
  }

  .template-actions {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    align-self: stretch;
    overflow: hidden;
    width: 100%;
    border: 1px solid var(--token-border-subtle);
    border-radius: var(--token-radius-control);
    background: var(--token-surface-panel);
  }

  :global(.template-action) {
    width: 100%;
    height: calc(var(--token-spacing-unit) * 8);
    border-radius: 0;
    background: transparent;
    color: var(--token-ink-secondary);
  }

  :global(.template-action + .template-action) {
    border-left: 1px solid var(--token-border-subtle);
  }

  :global(.template-action.use-action) {
    background: var(--token-color-primary-fill);
    color: var(--token-color-primary-on-fill);
  }

  :global(.template-action.use-action:hover:not(:disabled)) {
    background: var(--token-color-primary-fill-hover);
  }

  :global(.template-action.delete-action) {
    background: var(--token-color-danger-surface);
    color: var(--token-color-danger-text);
  }

  :global(.template-action.delete-action:hover:not(:disabled)) {
    background: var(--token-color-danger-surface-hover);
  }

  :global(.template-action:not(.use-action, .delete-action):hover:not(:disabled)) {
    background: var(--token-surface-panel-hover);
    color: var(--token-ink-primary);
  }

  .permission-note {
    margin: 0;
    color: var(--token-ink-muted);
    font-size: var(--token-text-caption);
    line-height: var(--token-text-caption-leading);
  }

  .divider {
    border-top: 1px solid var(--token-border-subtle);
  }

  .section-heading {
    display: flex;
    align-items: baseline;
    gap: calc(var(--token-spacing-unit) * 1.5);
    margin: 0 0 calc(var(--token-spacing-unit) * 2);
    color: var(--token-ink-secondary);
    font-size: var(--token-text-label);
    line-height: var(--token-text-label-leading);
    font-weight: 600;
  }

  .section-heading span {
    color: var(--token-ink-muted);
    font-size: var(--token-text-caption);
    font-variant-numeric: tabular-nums;
    font-weight: 400;
  }

  .section-heading.compact {
    margin-bottom: calc(var(--token-spacing-unit) * 1.5);
    color: var(--token-ink-muted);
    font-size: var(--token-text-caption);
    line-height: var(--token-text-caption-leading);
    font-weight: 500;
  }

  .variable-list {
    overflow: hidden;
    border: 1px solid var(--token-border-subtle);
    border-radius: var(--token-radius-panel);
  }

  .variable + .variable {
    border-top: 1px solid var(--token-border-subtle);
  }

  .variable summary {
    display: flex;
    min-height: calc(var(--token-spacing-unit) * 8);
    align-items: center;
    justify-content: space-between;
    gap: calc(var(--token-spacing-unit) * 2);
    padding: calc(var(--token-spacing-unit) * 1.5) calc(var(--token-spacing-unit) * 2);
    color: var(--token-ink-secondary);
    cursor: pointer;
    font-size: var(--token-text-caption);
    line-height: var(--token-text-caption-leading);
    list-style: none;
  }

  .variable summary::-webkit-details-marker {
    display: none;
  }

  .variable summary:hover {
    background: var(--token-surface-panel-hover);
  }

  .variable[open] > summary {
    background: var(--token-surface-panel-hover);
    color: var(--token-ink-primary);
  }

  .variable summary:focus-visible {
    outline: 2px solid var(--token-color-interactive-border);
    outline-offset: -2px;
  }

  .variable-name {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: calc(var(--token-spacing-unit) * 1.5);
    color: inherit;
    font: inherit;
    font-weight: 600;
    text-align: left;
  }

  .variable-name :global(svg) {
    flex: none;
    color: var(--token-ink-muted);
  }

  .variable-default {
    display: flex;
    align-items: center;
    margin-top: calc(var(--token-spacing-unit) * 1.5);
    color: var(--token-ink-secondary);
  }

  :global(.disclosure-icon) {
    flex: none;
    color: var(--token-ink-muted);
    transition: transform var(--token-motion-small) var(--token-ease-standard);
  }

  .variable[open] :global(.disclosure-icon) {
    transform: rotate(180deg);
  }

  .variable-body {
    padding: 0 calc(var(--token-spacing-unit) * 2) calc(var(--token-spacing-unit) * 2.5);
    color: var(--token-ink-muted);
  }

  .variable-body p {
    margin: 0;
  }

  .variable-description {
    display: block;
    width: 100%;
    margin: 0;
    padding: calc(var(--token-spacing-unit) * 0.5) 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    color: var(--token-ink-muted);
    cursor: text;
    font: inherit;
    text-align: left;
  }

  .variable-description:hover {
    color: var(--token-ink-secondary);
  }

  .variable-description:focus-visible {
    outline: 2px solid var(--token-color-interactive-surface);
    outline-offset: 2px;
  }

  :global(.variable-description-editor) {
    height: calc(var(--token-spacing-unit) * 18);
    min-height: calc(var(--token-spacing-unit) * 18);
    max-height: calc(var(--token-spacing-unit) * 18);
    margin-bottom: 0;
    resize: none;
    overflow-y: auto;
    border: 0;
    border-radius: 0;
    background: transparent;
    box-shadow: none;
    color: var(--token-ink-secondary);
    font-size: var(--token-text-caption);
    line-height: var(--token-text-caption-leading);
  }

  .tag-list {
    display: flex;
    flex-wrap: wrap;
    gap: calc(var(--token-spacing-unit) * 1);
    margin: calc(var(--token-spacing-unit) * 2) 0 0;
  }

  .tag-form {
    display: flex;
    align-items: center;
    gap: calc(var(--token-spacing-unit) * 1);
    margin-bottom: 0;
  }

  .tag-token {
    display: inline-flex;
    overflow: hidden;
    align-items: center;
    border: 1px solid var(--token-border-subtle);
    border-radius: var(--token-radius-control);
    background: var(--token-surface-panel);
  }

  .tag-token :global([data-slot="badge"]) {
    border: 0;
    border-radius: 0;
  }

  .remove-tag {
    display: inline-grid;
    width: calc(var(--token-spacing-unit) * 5);
    height: calc(var(--token-spacing-unit) * 5);
    padding: 0;
    border: 0;
    border-left: 1px solid var(--token-border-subtle);
    background: transparent;
    color: var(--token-ink-muted);
    cursor: pointer;
    place-items: center;
  }

  .remove-tag:hover:not(:disabled) {
    background: var(--token-surface-panel-hover);
    color: var(--token-ink-primary);
  }

  .remove-tag:focus-visible {
    outline: 2px solid var(--token-color-interactive-border);
    outline-offset: -2px;
  }

  .remove-tag:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  :global(.tag-input) {
    height: calc(var(--token-spacing-unit) * 7);
    flex: 1;
    border-color: var(--token-border-subtle);
    background: var(--token-surface-panel);
    font-size: var(--token-text-caption);
    line-height: var(--token-text-caption-leading);
  }
</style>
