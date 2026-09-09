<script lang="ts">
  import { ScreenGroup } from "$authored-components/screen";
  import { Button } from "$vendored-components/button";
  import * as Tabs from "$vendored-components/tabs";
  import BandTabs from "$app-views/categories/agents/components/band-tabs.svelte";
  import ScopeEditor from "$app-views/categories/agents/components/scope-editor.svelte";
  import ScrollWell from "$app-views/categories/agents/components/scroll-well.svelte";
  import ToolGrants from "$app-views/categories/agents/components/tool-grants.svelte";
  import { agentsLibrary, ownerOf } from "$app-views/categories/agents/procedures/agents";
  import { releaseWhenGone } from "$app-views/categories/agents/procedures/effects/release.svelte";
  import { run, type Working } from "$app-views/categories/agents/procedures/run";
  import { setScope } from "$app-views/categories/agents/procedures/set-scope";
  import { workspaceState } from "$model/client/workspace-state";

  let {
    label,
    owner,
    personaId,
    chosen,
    aligned = false,
    disabled = false,
    onchange
  }: {
    label: string;
    owner?: string;
    personaId?: string;
    chosen?: string;
    aligned?: boolean;
    disabled?: boolean;
    onchange?: (next: string) => void;
  } = $props();

  const view = workspaceState();
  const library = agentsLibrary();

  const surface: Working = $state({ mounted: true, busy: undefined, failure: undefined });
  releaseWhenGone(surface);

  const answer = $derived(library.ready ? library.current : undefined);
  const held = $derived(owner === undefined ? undefined : ownerOf(answer, owner));
  const restorable = $derived(held !== undefined && held.kind !== "persona" && held.scope !== null);

  let shown = $state("Scope");

  const SAYS = {
    Scope: "What it may search, read and quote.",
    Tools: "What it may do while it works."
  } as const;

  const restore = () => {
    if (held === undefined) return;
    void run(surface, "restore", () => setScope(view, held, null));
  };
</script>

{#snippet scope()}
  <ScopeEditor {owner} {personaId} {disabled} />
{/snippet}

{#snippet tools()}
  <ToolGrants {owner} {personaId} {chosen} {disabled} {onchange} />
{/snippet}

<ScreenGroup {label} fill>
  {#snippet actions()}
    {#if !aligned}
      {#if shown === "Scope" && restorable}
        <Button
          variant="outline"
          size="xs"
          disabled={disabled || surface.busy !== undefined}
          title="Read whatever the persona reads"
          onclick={restore}
        >
          Persona defaults
        </Button>
      {/if}
      <BandTabs
        label="What it may reach"
        options="Scope,Tools"
        value={shown}
        onchange={(next) => (shown = next)}
      />
    {/if}
  {/snippet}

  <div class="grants">
    {#if aligned}
      <Tabs.Root value={shown} onValueChange={(next: string) => (shown = next)} class="grant-stack">
        <Tabs.List variant="line">
          <Tabs.Trigger value="Scope">Scope</Tabs.Trigger>
          <Tabs.Trigger value="Tools">Tools</Tabs.Trigger>
        </Tabs.List>

        <Tabs.Content value="Scope" class="grant-pane">
          <p class="says">{SAYS.Scope}</p>
          <ScrollWell label="Scope">{@render scope()}</ScrollWell>
        </Tabs.Content>

        <Tabs.Content value="Tools" class="grant-pane">
          <p class="says">{SAYS.Tools}</p>
          <ScrollWell label="Tools">{@render tools()}</ScrollWell>
        </Tabs.Content>
      </Tabs.Root>
    {:else}
      <ScrollWell label={shown}>
        {#if shown === "Scope"}
          {@render scope()}
        {:else}
          {@render tools()}
        {/if}
      </ScrollWell>
    {/if}
  </div>
</ScreenGroup>

<style>
  .grants {
    display: flex;
    min-height: 0;
    flex: 1;
    flex-direction: column;
  }

  .grants :global(.grant-stack) {
    display: flex;
    min-height: 0;
    flex: 1;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 3);
  }

  .grants :global(.grant-pane) {
    display: flex;
    min-height: 0;
    flex: 1;
    flex-direction: column;
    gap: calc(var(--token-spacing-unit) * 2);
  }

  .says {
    margin: 0;
    color: var(--token-ink-muted);
    font-size: var(--token-text-caption);
    line-height: var(--token-text-caption-leading);
  }
</style>
