<script lang="ts">
  import Braces from "@lucide/svelte/icons/braces";
  import File from "@lucide/svelte/icons/file";
  import FileImage from "@lucide/svelte/icons/file-image";
  import FileMusic from "@lucide/svelte/icons/file-music";
  import FileText from "@lucide/svelte/icons/file-text";
  import FileVideo from "@lucide/svelte/icons/file-video";
  import FolderTree from "@lucide/svelte/icons/folder-tree";
  import Globe from "@lucide/svelte/icons/globe";
  import Plus from "@lucide/svelte/icons/plus";
  import Presentation from "@lucide/svelte/icons/presentation";
  import Sheet from "@lucide/svelte/icons/sheet";
  import Table2 from "@lucide/svelte/icons/table-2";
  import Target from "@lucide/svelte/icons/target";
  import X from "@lucide/svelte/icons/x";

  import { ScreenNote } from "$authored-components/screen";
  import { Button } from "$vendored-components/button";
  import * as DropdownMenu from "$vendored-components/dropdown-menu";
  import { agentsLibrary, ownerOf } from "$app-views/categories/agents/procedures/agents";
  import { releaseWhenGone } from "$app-views/categories/agents/procedures/effects/release.svelte";
  import { run, type Working } from "$app-views/categories/agents/procedures/run";
  import { setScope } from "$app-views/categories/agents/procedures/set-scope";
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

  const surface: Working = $state({ mounted: true, busy: undefined, failure: undefined });
  releaseWhenGone(surface);

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

  const write = (next: ReturnType<typeof withoutRow>) => {
    if (held === undefined) return;
    void run(surface, "scope", () => setScope(view, held, next));
  };

  const ICON = new Map([
    ["project", Globe],
    ["set", FolderTree],
    ["document", FileText],
    ["presentation", Presentation],
    ["spreadsheet", Sheet],
    ["finding", Target],
    ["externalFile::text", FileText],
    ["externalFile::code", Braces],
    ["externalFile::data", Table2],
    ["externalFile::image", FileImage],
    ["externalFile::audio", FileMusic],
    ["externalFile::video", FileVideo],
    ["externalFile::unknown", File]
  ]);

  const iconOf = (refKind: string) => ICON.get(refKind) ?? FileText;
</script>

{#if surface.failure}
  <ScreenNote tone="gap">{surface.failure}</ScreenNote>
{/if}

<ul class="scope surface-seam-grid">
  <li class="add">
    <DropdownMenu.Root>
      <DropdownMenu.Trigger disabled={frozen || surface.busy !== undefined}>
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
              <span class="option">
                <span>{option.name}</span>
                {#if option.relativePath && option.relativePath !== option.name}
                  <small>{option.relativePath}</small>
                {/if}
              </span>
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
      <span class="name" title={row.title}>
        <span>{row.title}</span>
        {#if row.refKind.startsWith("externalFile::") && row.detail !== row.title}
          <small>{row.detail}</small>
        {/if}
      </span>
      {#if !frozen}
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Remove {row.title}"
          disabled={surface.busy !== undefined}
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

  .mark[class*="kind-externalFile::"] {
    background: var(--token-color-interactive-surface);
    color: var(--token-color-interactive-text);
  }

  .name {
    display: flex;
    overflow: hidden;
    flex-direction: column;
    color: var(--token-ink-primary);
    font-size: var(--token-text-body-sm);
    line-height: var(--token-text-body-sm-leading);
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .name span,
  .name small,
  .option span,
  .option small {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .name small,
  .option small {
    color: var(--token-ink-muted);
    font-size: 10px;
  }

  .option {
    display: flex;
    min-width: 0;
    flex-direction: column;
  }
</style>
