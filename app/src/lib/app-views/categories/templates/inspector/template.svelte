<script lang="ts">
  import Braces from "@lucide/svelte/icons/braces";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import Copy from "@lucide/svelte/icons/copy";
  import Plus from "@lucide/svelte/icons/plus";
  import Trash2 from "@lucide/svelte/icons/trash-2";

  import { Panel, PanelButton, PanelChip, PanelEmpty } from "$authored-components/panel";
  import { Button } from "$vendored-components/button";
  import { Input } from "$vendored-components/input";
  import { Textarea } from "$vendored-components/textarea";
  import {
    addTemplateTag,
    duplicateTemplate,
    removeTemplate,
    templateIn,
    updateTemplateDescription,
    type LibraryTemplate
  } from "$app-views/categories/templates/procedures/library.svelte";
  import { workspaceState } from "$model/client/workspace-state";

  const view = workspaceState();
  const template = $derived(
    templateIn(
      view.project,
      view.selection?.kind === "template" ? view.selection.id : undefined
    )
  );

  let editingDescription = $state(false);
  let descriptionDraft = $state("");
  let tagDraft = $state("");
  let activeTemplateId = $state<string>();

  $effect(() => {
    if (template?.id === activeTemplateId) return;
    activeTemplateId = template?.id;
    descriptionDraft = template?.description ?? "";
    tagDraft = "";
    editingDescription = false;
  });

  const inspect = (row: LibraryTemplate) =>
    view.inspect("templates.template", { kind: "template", id: row.id });

  const commitDescription = () => {
    if (template === undefined) return;
    updateTemplateDescription(view.project, template.id, descriptionDraft);
    editingDescription = false;
  };

  const cancelDescription = () => {
    descriptionDraft = template?.description ?? "";
    editingDescription = false;
  };

  const descriptionKeydown = (event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      cancelDescription();
      return;
    }
    if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      commitDescription();
    }
  };

  const addTag = () => {
    if (template === undefined) return;
    if (addTemplateTag(view.project, template.id, tagDraft)) tagDraft = "";
  };

  const duplicate = () => {
    if (template === undefined) return;
    const copy = duplicateTemplate(view.project, template.id);
    if (copy !== undefined) inspect(copy);
  };

  const remove = () => {
    if (template === undefined) return;
    if (!confirm(`Delete “${template.name}”?`)) return;
    if (removeTemplate(view.project, template.id)) view.inspect("empty");
  };
</script>

<Panel title={template?.name ?? "Template"}>
  {#if template}
    <div class="inspector-stack">
      <div class="identity">
        <p class="meta-line">
          <span>{template.scope}</span>
          <span aria-hidden="true">·</span>
          <span>{template.makes}</span>
          <span aria-hidden="true">·</span>
          <span>Updated {template.updated}</span>
        </p>
        <p class="byline">Created by {template.createdBy}</p>

        {#if editingDescription}
          <Textarea
            class="description-editor"
            bind:value={descriptionDraft}
            aria-label="Template description"
            rows={3}
            onblur={commitDescription}
            onkeydown={descriptionKeydown}
          />
        {:else}
          <button
            type="button"
            class="description"
            aria-label="Edit template description"
            title="Double-click to edit description"
            ondblclick={() => (editingDescription = true)}
            onkeydown={(event) => {
              if (event.key === "Enter" || event.key === " ") editingDescription = true;
            }}
          >
            {template.description || "Add a description"}
          </button>
        {/if}

        <div class="template-actions" aria-label="Template actions">
          <PanelButton label="Duplicate" icon={Copy} onclick={duplicate} />
          <PanelButton label="Delete" icon={Trash2} tone="danger" onclick={remove} />
        </div>
      </div>

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
                  <p>{variable.description}</p>
                  <dl>
                    <dt>Key</dt>
                    <dd class="mono">{variable.name}</dd>
                    <dt>Type</dt>
                    <dd>{variable.type}</dd>
                    <dt>Requirement</dt>
                    <dd>{variable.required ? "Required" : "Optional"}</dd>
                  </dl>
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

        {#if template.tags.length > 0}
          <div class="tag-list">
            {#each template.tags as tag (tag)}
              <PanelChip>{tag}</PanelChip>
            {/each}
          </div>
        {/if}

        <form
          class="tag-form"
          onsubmit={(event) => {
            event.preventDefault();
            addTag();
          }}
        >
          <Input
            class="tag-input"
            bind:value={tagDraft}
            aria-label="New tag"
            placeholder="Add a tag"
          />
          <Button
            variant="outline"
            size="icon-sm"
            class="border-border-subtle bg-surface-panel hover:bg-surface-panel-hover dark:bg-surface-panel dark:hover:bg-surface-panel-hover"
            aria-label="Add tag"
            title="Add tag"
            disabled={tagDraft.trim() === ""}
            type="submit"
          >
            <Plus aria-hidden="true" />
          </Button>
        </form>
      </section>
    </div>
  {:else}
    <PanelEmpty title="That template is not in this library." />
  {/if}
</Panel>

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
  .variable-body,
  .variable-body dl {
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

  .description {
    width: 100%;
    margin: calc(var(--token-spacing-unit) * 1) 0 0;
    padding: calc(var(--token-spacing-unit) * 2);
    border: 1px solid transparent;
    border-radius: var(--token-radius-control);
    background: transparent;
    color: var(--token-ink-secondary);
    cursor: text;
    text-align: left;
  }

  .description:hover {
    border-color: var(--token-border-subtle);
    background: var(--token-surface-panel-hover);
  }

  .description:focus-visible {
    border-color: var(--token-color-interactive-border);
    outline: 2px solid var(--token-color-interactive-surface);
    outline-offset: 1px;
  }

  :global(.description-editor) {
    min-height: calc(var(--token-spacing-unit) * 20);
    resize: vertical;
    border-color: var(--token-border-subtle);
    background: var(--token-surface-panel);
    color: var(--token-ink-secondary);
    font-size: var(--token-text-caption);
    line-height: var(--token-text-caption-leading);
  }

  .template-actions {
    display: flex;
    flex-wrap: wrap;
    gap: calc(var(--token-spacing-unit) * 1);
    margin-top: calc(var(--token-spacing-unit) * 1);
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

  .variable summary:focus-visible {
    outline: 2px solid var(--token-color-interactive-border);
    outline-offset: -2px;
  }

  .variable-name {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: calc(var(--token-spacing-unit) * 1.5);
  }

  .variable-name :global(svg) {
    flex: none;
    color: var(--token-ink-muted);
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
    margin: 0 0 calc(var(--token-spacing-unit) * 2);
  }

  .variable-body dl {
    display: grid;
    grid-template-columns: minmax(0, 5rem) minmax(0, 1fr);
    gap: calc(var(--token-spacing-unit) * 1) calc(var(--token-spacing-unit) * 2);
    margin: 0;
  }

  .variable-body dt,
  .variable-body dd {
    min-width: 0;
    margin: 0;
    font-size: inherit;
  }

  .variable-body dt {
    color: var(--token-ink-secondary);
    font-weight: 600;
  }

  .variable-body dd {
    color: var(--token-ink-muted);
  }

  .variable-body .mono {
    overflow: hidden;
    font-family: var(--token-font-mono);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .tag-list {
    display: flex;
    flex-wrap: wrap;
    gap: calc(var(--token-spacing-unit) * 1);
    margin-bottom: calc(var(--token-spacing-unit) * 2);
  }

  .tag-form {
    display: flex;
    align-items: center;
    gap: calc(var(--token-spacing-unit) * 1);
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
