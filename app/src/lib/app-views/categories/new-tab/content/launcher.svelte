<script lang="ts">
  import { ScreenCard, ScreenEmpty, ScreenGroup, ScreenNote, ScreenShelf, ScreenShelfItem, ScreenSurface, ScreenThumb } from "$authored-components/screen";
  import { Button } from "$vendored-components/button";
  import ProjectResources from "$app-views/categories/new-tab/components/project-resources.svelte";
  import { LauncherState } from "$app-views/categories/new-tab/content/launcher.state.svelte";
  import { CREATE, RESOURCE_ICON, RESOURCE_LABEL } from "$app-views/categories/new-tab/procedures/options";
  import { createResource } from "$app-views/categories/new-tab/procedures/create-resource";
  import { keepLauncherCurrent } from "$app-views/categories/new-tab/procedures/effects/launcher.svelte";
  import { launchResource } from "$app-views/categories/new-tab/procedures/launch-resource";
  import { inspectResource } from "$app-views/categories/new-tab/procedures/inspect-resource";
  import { recentsOf } from "$app-views/categories/new-tab/procedures/resources";
  import { launcherResources } from "$app-views/categories/new-tab/procedures/read-resources";
  import { workspaceState } from "$model/client/workspace-state";

  const view = workspaceState();
  const state = new LauncherState();
  keepLauncherCurrent(state);
  const resourceIndex = launcherResources();
  const recent = $derived(recentsOf(resourceIndex.ready ? resourceIndex.current : undefined, state.now));
</script>

<ScreenSurface wide>
  <div class="launcher-board">
    <div class="area-create">
      <ScreenGroup label="Create">
        <div class="create-actions" role="group" aria-label="What you can make">
          {#each CREATE as choice (choice.key)}
            {@const Icon = choice.icon}
            <Button
              variant="outline"
              class="create-action {choice.tint}"
              disabled={state.pending !== undefined}
              onclick={() => void createResource(view, state, choice.key)}
            >
              <Icon aria-hidden="true" />
              {choice.label}
            </Button>
          {/each}
        </div>
        {#if state.error}
          <ScreenNote tone="gap">{state.error}</ScreenNote>
        {/if}
      </ScreenGroup>
    </div>

    <div class="area-recent">
      <ScreenGroup label="Recent">
        {#if resourceIndex.error}
          <ScreenEmpty title="Recent resources could not be loaded" />
        {:else if !resourceIndex.ready}
          <ScreenEmpty title="Loading recent resources" />
        {:else if recent.length === 0}
          <ScreenEmpty title="Your recent work will appear here">
            Create a resource to get started.
          </ScreenEmpty>
        {:else}
          <ScreenShelf label="Recent resources">
            {#each recent as row (row.id)}
              <ScreenShelfItem width="13rem">
                <div
                  class="recent-card"
                  title={row.name}
                  ondblclick={() => launchResource(view, row)}
                  onkeydown={(event) => {
                    if (event.key !== "Enter") return;
                    event.preventDefault();
                    launchResource(view, row);
                  }}
                  role="presentation"
                >
                  <ScreenCard
                    title={row.name}
                    sub={RESOURCE_LABEL[row.kind]}
                    icon={RESOURCE_ICON[row.kind]}
                    selected={view.selection?.id === row.id}
                    onselect={() => inspectResource(view, row)}
                  >
                    {#snippet thumb()}
                      <span class="preview"><ScreenThumb ratio="4 / 3" lines={4} /></span>
                    {/snippet}
                    <span class="text-caption text-ink-muted truncate" title={"Updated " + row.updated}>
                      Updated {row.updated}
                    </span>
                  </ScreenCard>
                </div>
              </ScreenShelfItem>
            {/each}
          </ScreenShelf>
        {/if}
      </ScreenGroup>
    </div>

    <div class="area-resources">
      <ProjectResources now={state.now} onopen={(row) => launchResource(view, row)} />
    </div>
  </div>
</ScreenSurface>

<style>
  .launcher-board {
    display: flex;
    min-width: 0;
    flex: 1;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 6);
  }

  .create-actions {
    display: flex;
    flex-wrap: wrap;
    gap: calc(var(--token-spacing-unit) * 2);
  }

  :global(.create-action) {
    flex: 1 1 auto;
    min-height: calc(var(--token-spacing-unit) * 10);
    padding-inline: calc(var(--token-spacing-unit) * 3);
  }

  .recent-card > :global(button) {
    width: 100%;
    box-shadow: var(--token-shadow-raised);
  }

  .preview {
    display: flex;
    height: calc(var(--token-spacing-unit) * 20);
    align-items: center;
    justify-content: center;
  }

  .preview > :global(*) {
    height: 100%;
    width: auto;
    flex: none;
  }

  .area-resources {
    display: flex;
    min-height: calc(var(--token-spacing-unit) * 72);
    flex: 1;
    flex-direction: column;
  }
</style>
