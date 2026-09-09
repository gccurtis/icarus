<script lang="ts">
  import Plus from "@lucide/svelte/icons/plus";
  import Target from "@lucide/svelte/icons/target";

  import { OverlayModal } from "$authored-components/overlay";
  import {
    Panel,
    PanelBanner,
    PanelButton,
    PanelEditableText,
    PanelEmpty,
    PanelField,
    PanelFields,
    PanelInput,
    PanelNote,
    PanelSearch,
    PanelSection
  } from "$authored-components/panel";
  import { ScopeBuilder } from "$authored-components/scope-builder";
  import { ContextsState } from "$app-views/categories/project-overview/context/contexts.state.svelte";
  import {
    builderView,
    nextSetName,
    offeringOf,
    projectResources,
    resourceSets,
    resourcesIn,
    ruleOf,
    scopeNamesOf,
    setsIn,
    type ResourceSetItem
  } from "$app-views/categories/project-overview/procedures/contexts";
  import { releaseContexts } from "$app-views/categories/project-overview/procedures/effects/contexts.svelte";
  import { workspaceState } from "$model/client/workspace-state";

  const view = workspaceState();
  const answer = resourceSets();
  const index = projectResources();
  const sets = $derived(setsIn(answer.ready ? answer.current : undefined));
  const catalogue = $derived(resourcesIn(index.ready ? index.current : undefined));
  const names = $derived(scopeNamesOf(sets, catalogue));

  const state = new ContextsState({ view, sets: () => sets });
  releaseContexts(state);

  const shown = $derived(
    sets.filter((set) =>
      set.name.toLocaleLowerCase().includes(state.query.trim().toLocaleLowerCase())
    )
  );
  const busy = $derived(state.pending !== undefined);

  const offering = $derived(offeringOf(sets, catalogue, state.editing?.id));
  const view$ = $derived(builderView(state.draft, offering));

  const scopeBlocked = $derived(
    state.draft.include.length === 0
      ? "Include something, or choose the whole project."
      : undefined
  );

  const countOf = (set: ResourceSetItem): string =>
    set.resolves === 0 ? "matches nothing" : `${set.resolves} ${set.resolves === 1 ? "resource" : "resources"}`;
</script>

<Panel title="Contexts">
  {#snippet actions()}
    <PanelButton label="New set" icon={Plus} tone={state.creating ? "default" : "primary"} disabled={busy} onclick={() => (state.creating = !state.creating)} />
  {/snippet}

  {#if state.actionError}
    <PanelBanner title="That did not happen" tone="attention">{state.actionError}</PanelBanner>
  {/if}

  {#if state.creating}
    <PanelSection title="New set" chevron="end">
      <div class="add">
        <PanelInput label="Set name" placeholder={nextSetName(sets)} flush bind:value={state.nameDraft} onenter={() => state.create()} />
        <PanelButton label="Create" tone="primary" disabled={busy} onclick={() => state.create()} />
      </div>
      <div class="rule">
        <PanelNote>{ruleOf(state.draft, names)}.</PanelNote>
        <PanelButton
          label="Choose what it selects"
          disabled={busy}
          title="Open the builder on this set"
          onclick={() => state.openBuilder()}
        />
      </div>
    </PanelSection>
  {/if}

  {#if answer.error}
    <PanelBanner title="Sets unavailable" tone="danger">
      {answer.error instanceof Error ? answer.error.message : String(answer.error)}
    </PanelBanner>
  {:else if !answer.ready}
    <PanelNote>Reading the project's sets…</PanelNote>
  {:else if sets.length === 0}
    <PanelEmpty title="No saved sets yet" action="A set is a rule a prompt looks things up in, and what a template variable is answered with" />
  {:else}
    <PanelSearch placeholder="Filter sets…" matched={shown.length} total={sets.length} flush bind:value={state.query}>
      {#each shown as set (set.id)}
        <div class="set">
          <PanelSection title={set.name} count={countOf(set)} open={false} chevron="end">
            <PanelFields>
              <PanelField label="Name" stacked>
                <PanelEditableText value={set.name} label={`Name of ${set.name}`} disabled={busy} onchange={(next) => state.rename(set, next)} />
              </PanelField>
              <PanelField label="Description" stacked>
                <PanelEditableText value={set.description ?? ""} label={`Description of ${set.name}`} placeholder="What this set is for" multiline disabled={busy} onchange={(next) => state.describe(set, next)} />
              </PanelField>
              <PanelField label="Rule" stacked>{ruleOf(set.set, names)}</PanelField>
              <PanelField label="Selects now" mono>{countOf(set)}</PanelField>
              <PanelField label="Created by">{set.createdByName}</PanelField>
            </PanelFields>
            {#if set.resolves === 0}
              <PanelNote tone="gap">A set that matches nothing widens a prompt to the whole project rather than narrowing it to nothing.</PanelNote>
            {/if}
            <div class="remove">
              <PanelButton
                label="Change what it selects"
                disabled={busy}
                title={`Open the builder on “${set.name}”`}
                onclick={() => state.openBuilder(set)}
              />
              <PanelButton label="Delete set" tone="danger" disabled={busy} title={`Delete “${set.name}” — refused while another set or a template still names it`} onclick={() => state.remove(set)} />
            </div>
          </PanelSection>
        </div>
      {/each}
    </PanelSearch>
  {/if}
  <PanelNote>Counts are resolved when this panel reads, never stored. <Target size={12} aria-hidden="true" /></PanelNote>
</Panel>

<OverlayModal
  bind:open={state.builderOpen}
  title={state.editing === undefined ? "A set of resources" : `What “${state.editing.name}” selects`}
  description="A set is a rule, resolved when it is read. Everything a prompt or a template variable can be answered with is built here."
  confirm={state.editing === undefined ? "Use this" : "Save"}
  width="narrow"
  blocked={scopeBlocked}
  onconfirm={() => state.confirmBuilder()}
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
  .add {
    display: flex;
    align-items: center;
    gap: calc(var(--token-spacing-unit) * 1);
    margin-bottom: calc(var(--token-spacing-unit) * 2);
  }

  .add > :global(:first-child) {
    min-width: 0;
    flex: 1;
  }

  .set {
    border-top: 1px solid var(--token-border-subtle);
  }

  .rule {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: calc(var(--token-spacing-unit) * 1);
    margin: calc(var(--token-spacing-unit) * 2) 0;
  }

  .remove {
    display: flex;
    gap: calc(var(--token-spacing-unit) * 1);
    margin-top: calc(var(--token-spacing-unit) * 2);
  }
</style>
