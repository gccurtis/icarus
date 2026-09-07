<script lang="ts">
  import { onDestroy } from "svelte";
  import FileText from "@lucide/svelte/icons/file-text";
  import FolderTree from "@lucide/svelte/icons/folder-tree";
  import Globe from "@lucide/svelte/icons/globe";
  import Plus from "@lucide/svelte/icons/plus";
  import Presentation from "@lucide/svelte/icons/presentation";
  import Sheet from "@lucide/svelte/icons/sheet";
  import Target from "@lucide/svelte/icons/target";
  import X from "@lucide/svelte/icons/x";

  import { ScreenNote } from "$authored-components/screen";
  import { Button } from "$vendored-components/button";
  import * as DropdownMenu from "$vendored-components/dropdown-menu";
  import {
    agentsLibrary,
    messageOf,
    ownerOf,
    setScope
  } from "$app-views/categories/agents/procedures/library.svelte";
  import {
    scopeRows,
    withProject,
    withResource,
    withSet,
    withoutRow
  } from "$app-views/categories/agents/procedures/scope";
  import { workspaceState } from "$model/client/workspace-state";

  let {
    owner,
    personaId,
    disabled = false
  }: {
    owner?: string;
    personaId?: string;
    disabled?: boolean;
  } = $props();

  const view = workspaceState();
  const library = agentsLibrary();

  let live = true;
  onDestroy(() => {
    live = false;
  });

  const answer = $derived(library.ready ? library.current : undefined);
  const sets = $derived(answer?.resourceSets ?? []);
  const resources = $derived(answer?.resources ?? []);
  const held = $derived(owner === undefined ? undefined : ownerOf(answer, owner));
  const fromPersona = $derived(held?.kind === "persona" ? undefined : (held?.personaId ?? personaId));
  const persona = $derived(
    fromPersona === undefined
      ? undefined
      : answer?.personas.find((candidate) => candidate.id === fromPersona)
  );
  const own = $derived(held?.scope ?? null);
  const inherited = $derived(held === undefined || (held.kind !== "persona" && own === null));
  const shown = $derived(inherited ? (persona?.scope ?? null) : own);
  const rows = $derived(scopeRows(shown, sets, resources));
  const frozen = $derived(disabled || held === undefined || held.finished);

  let pending = $state(false);
  let actionError = $state<string>();

  const write = async (next: ReturnType<typeof withoutRow>) => {
    if (held === undefined) return;
    pending = true;
    actionError = undefined;
    try {
      const result = await setScope(view, held, next);
      if (live && !result.accepted) actionError = result.detail;
    } catch (error) {
      if (live) actionError = messageOf(error);
    } finally {
      pending = false;
    }
  };

  const ICON = new Map([
    ["project", Globe],
    ["set", FolderTree],
    ["document", FileText],
    ["slides", Presentation],
    ["spreadsheet", Sheet],
    ["finding", Target]
  ]);

  const iconOf = (refKind: string) => ICON.get(refKind) ?? FileText;
</script>

{#if actionError}
  <ScreenNote tone="gap">{actionError}</ScreenNote>
{/if}

<ul class="scope surface-seam-grid">
  <li class="add">
    <DropdownMenu.Root>
      <DropdownMenu.Trigger disabled={frozen || pending}>
        {#snippet child({ props })}
          <button {...props} type="button" class="add-row">
            <Plus size={16} aria-hidden="true" />
            <span>Add resource</span>
          </button>
        {/snippet}
      </DropdownMenu.Trigger>
      <DropdownMenu.Content align="start" class="max-h-80 w-72 overflow-y-auto">
        <DropdownMenu.Item onSelect={() => write(withProject(shown))}>
          <Globe size={14} aria-hidden="true" />
          Everything in this project
        </DropdownMenu.Item>
        {#if sets.length > 0}
          <DropdownMenu.Separator />
          {#each sets as option (option.id)}
            <DropdownMenu.Item onSelect={() => write(withSet(shown, option.id))}>
              <FolderTree size={14} aria-hidden="true" />
              <span class="truncate">{option.name}</span>
            </DropdownMenu.Item>
          {/each}
        {/if}
        {#if resources.length > 0}
          <DropdownMenu.Separator />
          {#each resources as option (`${option.ref.kind}:${option.ref.id}`)}
            {@const Icon = iconOf(option.ref.kind)}
            <DropdownMenu.Item onSelect={() => write(withResource(shown, option.ref))}>
              <Icon size={14} aria-hidden="true" />
              <span class="truncate">{option.name}</span>
            </DropdownMenu.Item>
          {/each}
        {/if}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  </li>

  {#each rows as row (row.key)}
    {@const Icon = iconOf(row.refKind)}
    <li class="entry">
      <span class="mark kind-{row.refKind}">
        <Icon size={15} aria-hidden="true" />
      </span>
      <span class="name" title={row.title}>{row.title}</span>
      {#if !frozen}
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Remove {row.title}"
          disabled={pending}
          onclick={() => write(withoutRow(shown, row.key))}
        >
          <X aria-hidden="true" />
        </Button>
      {/if}
    </li>
  {/each}
</ul>

<style>
  .scope {
    grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .entry {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: calc(var(--token-spacing-unit) * 3);
    align-items: center;
    padding: calc(var(--token-spacing-unit) * 2) calc(var(--token-spacing-unit) * 3);
  }

  .add-row {
    display: flex;
    width: 100%;
    min-height: calc(var(--token-spacing-unit) * 11);
    align-items: center;
    gap: calc(var(--token-spacing-unit) * 2);
    padding: calc(var(--token-spacing-unit) * 2) calc(var(--token-spacing-unit) * 3);
    border: 0;
    background: transparent;
    color: var(--token-ink-secondary);
    cursor: pointer;
    font-size: var(--token-text-body-sm);
    text-align: start;
  }

  .add-row:hover {
    background: var(--token-surface-panel-hover);
    color: var(--token-ink-primary);
  }

  .add-row:disabled {
    cursor: default;
    opacity: 0.6;
  }

  .mark {
    display: grid;
    width: calc(var(--token-spacing-unit) * 7);
    height: calc(var(--token-spacing-unit) * 7);
    place-items: center;
    border-radius: var(--token-radius-control);
    background: var(--token-surface-panel);
    color: var(--token-ink-secondary);
  }

  .mark.kind-project,
  .mark.kind-set {
    background: var(--token-color-intelligence-surface);
    color: var(--token-color-intelligence-text);
  }

  .mark.kind-document {
    background: var(--token-color-interactive-surface);
    color: var(--token-color-interactive-text);
  }

  .mark.kind-slides {
    background: var(--token-color-accent-1-surface);
    color: var(--token-color-accent-1-text);
  }

  .mark.kind-spreadsheet {
    background: var(--token-color-success-surface);
    color: var(--token-color-success-text);
  }

  .mark.kind-finding {
    background: var(--token-color-attention-surface);
    color: var(--token-color-attention-text);
  }

  .name {
    overflow: hidden;
    color: var(--token-ink-primary);
    font-size: var(--token-text-body-sm);
    line-height: var(--token-text-body-sm-leading);
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
