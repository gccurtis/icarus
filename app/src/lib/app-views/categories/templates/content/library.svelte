<script lang="ts">
  import ArrowDownNarrowWide from "@lucide/svelte/icons/arrow-down-narrow-wide";
  import ArrowUpNarrowWide from "@lucide/svelte/icons/arrow-up-narrow-wide";
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import FileText from "@lucide/svelte/icons/file-text";
  import Presentation from "@lucide/svelte/icons/presentation";
  import Sheet from "@lucide/svelte/icons/sheet";

  import {
    ScreenCard,
    ScreenCell,
    ScreenEmpty,
    ScreenFilters,
    ScreenGroup,
    ScreenHeader,
    ScreenRow,
    ScreenShelf,
    ScreenShelfItem,
    ScreenSurface,
    ScreenTable,
    ScreenThumb
  } from "$authored-components/screen";
  import { Button } from "$vendored-components/button";
  import * as DropdownMenu from "$vendored-components/dropdown-menu";
  import {
    recentTemplatesIn,
    templatesIn,
    type LibraryTemplate,
    type TemplateScope,
    type TemplateTarget
  } from "$app-views/categories/templates/procedures/library.svelte";
  import { workspaceState } from "$model/client/workspace-state";

  const view = workspaceState();
  const templates = $derived(templatesIn(view.project));
  const recent = $derived(recentTemplatesIn(view.project, 10));

  const SCOPES: readonly TemplateScope[] = ["Project", "Shared", "Personal"];

  const SORTS = [
    { value: "updated", label: "Updated" },
    { value: "name", label: "Name" },
    { value: "makes", label: "Makes" },
    { value: "variables", label: "Variables" }
  ] as const;

  const TARGETS: readonly TemplateTarget[] = ["Document", "Slide deck", "Spreadsheet"];

  const TARGET_ICON = {
    Document: FileText,
    "Slide deck": Presentation,
    Spreadsheet: Sheet
  } as const;

  const TARGET_RATIO: Record<TemplateTarget, string> = {
    Document: "4 / 3",
    "Slide deck": "16 / 9",
    Spreadsheet: "1 / 1"
  };

  /** One sorted union: the menu never invents a tag that no template carries. */
  const TAGS = $derived(
    [...new Set(templates.flatMap((row) => row.tags))].sort((a, b) => a.localeCompare(b))
  );

  let search = $state("");
  let scope = $state("all");
  let makes = $state("all");
  let selectedTags = $state<string[]>([]);
  let tagMode = $state<"all" | "some" | "none">("all");
  let sortBy = $state("updated");
  let direction = $state<"asc" | "desc">("asc");

  const allTagsSelected = $derived(tagMode === "all");
  const someTagsSelected = $derived(tagMode === "some");
  const tagFilterLabel = $derived(
    allTagsSelected
      ? "All tags"
      : tagMode === "none"
        ? "No tags"
        : selectedTags.length === 1
          ? selectedTags[0]
          : `${selectedTags.length} tags`
  );

  const setTag = (tag: string, checked: boolean) => {
    const chosen = new Set(tagMode === "all" ? TAGS : selectedTags);
    if (checked) chosen.add(tag);
    else chosen.delete(tag);
    selectedTags = TAGS.filter((candidate) => chosen.has(candidate));
    tagMode =
      selectedTags.length === 0
        ? "none"
        : selectedTags.length === TAGS.length
          ? "all"
          : "some";
  };

  const setAllTags = (checked: boolean) => {
    tagMode = checked ? "all" : "none";
    selectedTags = [];
  };

  const compare = (a: LibraryTemplate, b: LibraryTemplate): number => {
    if (sortBy === "name") return a.name.localeCompare(b.name);
    if (sortBy === "makes") return a.makes.localeCompare(b.makes) || a.name.localeCompare(b.name);
    if (sortBy === "variables") {
      return a.variables.length - b.variables.length || a.name.localeCompare(b.name);
    }
    return a.updatedAge - b.updatedAge || a.name.localeCompare(b.name);
  };

  const query = $derived(search.trim().toLocaleLowerCase());
  const searching = $derived(query !== "");
  const filtered = $derived(
    templates
      .filter((row) => scope === "all" || row.scope === scope)
      .filter((row) => makes === "all" || row.makes === makes)
      .filter(
        (row) =>
          tagMode === "all" ||
          (tagMode === "some" && row.tags.some((tag) => selectedTags.includes(tag)))
      )
      .filter(
        (row) =>
          query === "" ||
          row.name.toLocaleLowerCase().includes(query) ||
          row.description.toLocaleLowerCase().includes(query) ||
          row.tags.some((candidate) => candidate.toLocaleLowerCase().includes(query))
      )
  );

  const ordered = $derived(
    [...filtered].sort((a, b) => (direction === "asc" ? compare(a, b) : -compare(a, b)))
  );

  const filtersActive = $derived(
    searching || scope !== "all" || makes !== "all" || tagMode !== "all"
  );

  const DIRECTION: Record<string, { asc: string; desc: string }> = {
    updated: { asc: "Newest first", desc: "Oldest first" },
    name: { asc: "A to Z", desc: "Z to A" },
    makes: { asc: "A to Z", desc: "Z to A" },
    variables: { asc: "Fewest variables first", desc: "Most variables first" }
  };

  const variableCount = (row: LibraryTemplate): string =>
    `${row.variables.length} ${row.variables.length === 1 ? "variable" : "variables"}`;

  const clear = () => {
    search = "";
    scope = "all";
    makes = "all";
    selectedTags = [];
    tagMode = "all";
  };

  const isSelected = (id: string): boolean =>
    view.selection?.kind === "template" && view.selection.id === id;

  const inspect = (row: LibraryTemplate) =>
    view.inspect("templates.template", { kind: "template", id: row.id });

  const open = (row: LibraryTemplate) => alert(`Opening “${row.name}” is not wired up yet.`);
</script>

{#snippet recentCard(row: LibraryTemplate & { readonly lastUsed: string })}
  <div
    class="recent-card"
    class:chosen={isSelected(row.id)}
    ondblclick={() => open(row)}
    role="presentation"
  >
    <ScreenCard
      title={row.name}
      sub={`${row.makes} · ${row.scope}`}
      icon={TARGET_ICON[row.makes]}
      selected={isSelected(row.id)}
      onselect={() => inspect(row)}
    >
      {#snippet thumb()}
        <span class="shape">
          <ScreenThumb
            ratio={TARGET_RATIO[row.makes]}
            lines={4}
            variables={Math.min(row.variables.length, 4)}
          />
        </span>
      {/snippet}
      <span class="text-caption text-ink-muted truncate">
        Used {row.lastUsed} · {variableCount(row)}
      </span>
    </ScreenCard>
  </div>
{/snippet}

<ScreenSurface>
  <div class="library-stack">
    <ScreenHeader title="Templates">
      {#snippet actions()}
        <p class="text-caption text-ink-muted m-0 max-w-xs text-end">
          Reusable starting points for documents, slide decks, and spreadsheets.
        </p>
      {/snippet}
    </ScreenHeader>

    {#if recent.length > 0}
      <ScreenGroup label="Recently used">
        <ScreenShelf>
          {#each recent as row (row.id)}
            <ScreenShelfItem width="11rem">
              {@render recentCard(row)}
            </ScreenShelfItem>
          {/each}
        </ScreenShelf>
      </ScreenGroup>
    {/if}

    <ScreenGroup label="All templates">
      <div class="table-stack">
        <ScreenFilters
          placeholder="Search templates or tags"
          sorts={SORTS}
          bind:sort={sortBy}
          bind:value={search}
        >
          <select
            class="border-border-subtle bg-surface-panel text-caption rounded-control border px-2 py-1"
            bind:value={scope}
            aria-label="Scope"
          >
            <option value="all">All scopes</option>
            {#each SCOPES as option (option)}
              <option value={option}>{option}</option>
            {/each}
          </select>

          <select
            class="border-border-subtle bg-surface-panel text-caption rounded-control border px-2 py-1"
            bind:value={makes}
            aria-label="Makes"
          >
            <option value="all">All kinds</option>
            {#each TARGETS as option (option)}
              <option value={option}>{option}</option>
            {/each}
          </select>

          <DropdownMenu.Root>
            <DropdownMenu.Trigger>
              {#snippet child({ props })}
                <Button
                  {...props}
                  variant="outline"
                  size="sm"
                  class="border-border-subtle bg-surface-panel hover:bg-surface-panel-hover aria-expanded:bg-surface-panel text-caption rounded-control min-w-24 justify-between dark:bg-surface-panel dark:hover:bg-surface-panel-hover dark:aria-expanded:bg-surface-panel"
                  aria-label="Filter by tags: {tagFilterLabel}"
                  title={tagMode === "all"
                    ? TAGS.join(", ")
                    : selectedTags.length > 0
                      ? selectedTags.join(", ")
                      : "No tags selected"}
                >
                  <span class="max-w-24 truncate">{tagFilterLabel}</span>
                  <ChevronDown aria-hidden="true" />
                </Button>
              {/snippet}
            </DropdownMenu.Trigger>
            <DropdownMenu.Content align="end" class="max-h-56 w-56">
              <DropdownMenu.CheckboxItem
                class="tag-option"
                checked={allTagsSelected}
                indeterminate={someTagsSelected}
                closeOnSelect={false}
                onCheckedChange={setAllTags}
              >
                All
              </DropdownMenu.CheckboxItem>
              <DropdownMenu.Separator />
              {#each TAGS as option (option)}
                <DropdownMenu.CheckboxItem
                  class="tag-option"
                  checked={allTagsSelected || selectedTags.includes(option)}
                  closeOnSelect={false}
                  onCheckedChange={(checked: boolean) => setTag(option, checked)}
                >
                  {option}
                </DropdownMenu.CheckboxItem>
              {/each}
            </DropdownMenu.Content>
          </DropdownMenu.Root>

          {#snippet order()}
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={DIRECTION[sortBy][direction]}
              title={DIRECTION[sortBy][direction]}
              onclick={() => (direction = direction === "asc" ? "desc" : "asc")}
            >
              {#if direction === "asc"}
                <ArrowUpNarrowWide aria-hidden="true" />
              {:else}
                <ArrowDownNarrowWide aria-hidden="true" />
              {/if}
            </Button>
          {/snippet}
        </ScreenFilters>

        <div class="min-h-0">
          {#if ordered.length === 0}
            <ScreenEmpty
              kind={filtersActive ? "no-matches" : "nothing-yet"}
              title={filtersActive ? "No template matches" : "No templates yet"}
              onclear={filtersActive ? clear : undefined}
            >
              {filtersActive
                ? "Try another name, tag, scope or kind."
                : "Templates will appear here when one is created."}
            </ScreenEmpty>
          {:else}
            <ScreenTable columns={["Name", "Makes", "Scope", "Variables", "Tags", "Updated"]}>
              {#each ordered as row (row.id)}
                {@const Icon = TARGET_ICON[row.makes]}
                <ScreenRow
                  selected={isSelected(row.id)}
                  onselect={() => inspect(row)}
                  onopen={() => open(row)}
                >
                  <ScreenCell>
                    <button
                      type="button"
                      class="text-body-sm text-ink-primary flex min-h-9 items-center gap-2 text-start hover:underline"
                      onclick={() => inspect(row)}
                      ondblclick={() => open(row)}
                    >
                      <span class="text-ink-muted flex shrink-0">
                        <Icon size={14} aria-hidden="true" />
                      </span>
                      <span>{row.name}</span>
                    </button>
                  </ScreenCell>
                  <ScreenCell>{row.makes}</ScreenCell>
                  <ScreenCell>{row.scope}</ScreenCell>
                  <ScreenCell num>{row.variables.length}</ScreenCell>
                  <ScreenCell>{row.tags.join(", ") || "—"}</ScreenCell>
                  <ScreenCell num>{row.updated}</ScreenCell>
                </ScreenRow>
              {/each}
            </ScreenTable>
          {/if}
        </div>
      </div>
    </ScreenGroup>
  </div>
</ScreenSurface>

<style>
  .library-stack {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 8);
  }

  .table-stack {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 3);
  }

  .recent-card {
    height: 100%;
  }

  .recent-card > :global(button) {
    width: 100%;
    height: 100%;
    box-shadow: var(--token-shadow-raised);
  }

  .recent-card.chosen > :global(button) {
    border-color: var(--token-color-active-border);
    background: var(--token-color-active-surface);
    box-shadow:
      var(--token-shadow-raised),
      0 0 0 1px var(--token-color-active-border);
  }

  .recent-card.chosen > :global(button:hover) {
    background: var(--token-color-active-surface-hover);
  }

  /**
   * The preview keeps the target's shape inside a shorter, consistent card
   * band. Cards remain recognisable without making recent history dominate the
   * library beneath it.
   */
  .shape {
    display: flex;
    height: calc(var(--token-spacing-unit) * 16);
    align-items: center;
    justify-content: center;
  }

  .shape > :global(*) {
    width: auto;
    height: 100%;
    flex: none;
  }

  :global(.tag-option) {
    padding-right: calc(var(--token-spacing-unit) * 2);
    padding-left: calc(var(--token-spacing-unit) * 8);
  }

  :global(.tag-option > [data-slot="dropdown-menu-checkbox-item-indicator"]) {
    right: auto;
    left: calc(var(--token-spacing-unit) * 2);
    width: calc(var(--token-spacing-unit) * 4);
    height: calc(var(--token-spacing-unit) * 4);
    border: 1px solid var(--token-border-strong);
    border-radius: calc(var(--token-radius-control) / 2);
    background: var(--token-surface-canvas);
  }

  :global(.tag-option > [data-slot="dropdown-menu-checkbox-item-indicator"] > svg) {
    width: calc(var(--token-spacing-unit) * 3);
    height: calc(var(--token-spacing-unit) * 3);
  }

  @media (max-width: 60rem) {
    .library-stack {
      gap: calc(var(--token-spacing-unit) * 6);
    }
  }
</style>
