<script lang="ts">
  import { onDestroy } from "svelte";
  import Plus from "@lucide/svelte/icons/plus";
  import Target from "@lucide/svelte/icons/target";

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
    PanelSection,
    PanelToggle
  } from "$authored-components/panel";
  import {
    KINDS,
    changeSet,
    createSet,
    describeSet,
    emptySet,
    excludedKindsOf,
    isWholeProject,
    kindsOf,
    namesOf,
    nextSetName,
    removeSet,
    renameSet,
    resourceSets,
    ruleOf,
    setsIn,
    withExcludedKind,
    withKind,
    withWholeProject,
    type ResourceSet,
    type ResourceSetItem
  } from "$app-views/categories/project-overview/procedures/contexts";
  import { workspaceState } from "$model/client/workspace-state";

  const view = workspaceState();
  let live = true;
  onDestroy(() => {
    live = false;
  });

  const answer = resourceSets();
  const sets = $derived(setsIn(answer.ready ? answer.current : undefined));
  const names = $derived(namesOf(sets));

  let query = $state("");
  let creating = $state(false);
  let nameDraft = $state("");
  let draft = $state<ResourceSet>(emptySet());
  let pending = $state<string | undefined>(undefined);
  let actionError = $state<string | undefined>(undefined);

  const shown = $derived(
    sets.filter((set) => set.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
  );
  const busy = $derived(pending !== undefined);

  const run = async (key: string, work: () => Promise<void>) => {
    if (pending !== undefined) return;
    pending = key;
    actionError = undefined;
    try {
      await work();
    } catch (error) {
      if (live) actionError = error instanceof Error ? error.message : String(error);
    } finally {
      if (live) pending = undefined;
    }
  };

  const create = () =>
    run("create", async () => {
      const name = nameDraft.trim() || nextSetName(sets);
      await createSet(view, name, draft);
      if (!live) return;
      creating = false;
      nameDraft = "";
      draft = emptySet();
    });

  const change = (item: ResourceSetItem, next: ResourceSet) =>
    run(`change:${item.id}`, async () => {
      const result = await changeSet(view, item, next);
      if (live && !result.accepted) actionError = result.detail;
    });

  const rename = (item: ResourceSetItem, name: string) =>
    run(`rename:${item.id}`, async () => {
      if (name.trim() === "" || name.trim() === item.name) return;
      const result = await renameSet(view, item, name);
      if (live && !result.accepted) actionError = result.detail;
    });

  const describe = (item: ResourceSetItem, description: string) =>
    run(`describe:${item.id}`, async () => {
      if (description.trim() === (item.description ?? "")) return;
      const result = await describeSet(view, item, description);
      if (live && !result.accepted) actionError = result.detail;
    });

  const remove = (item: ResourceSetItem) =>
    run(`remove:${item.id}`, async () => {
      if (!confirm(`Delete the set “${item.name}”?`)) return;
      const result = await removeSet(view, item);
      if (live && !result.accepted) actionError = result.detail;
    });

  const countOf = (set: ResourceSetItem): string =>
    set.resolves === 0 ? "matches nothing" : `${set.resolves} ${set.resolves === 1 ? "resource" : "resources"}`;
</script>

{#snippet rule(set: ResourceSet, onchange: (next: ResourceSet) => void)}
  <div class="rule">
    <label class="toggle">
      <PanelToggle label="Whole project" checked={isWholeProject(set)} disabled={busy} onchange={(on) => onchange(withWholeProject(set, on))} />
      <span>Whole project</span>
    </label>
    {#each KINDS as entry (entry.kind)}
      <label class="toggle">
        <PanelToggle label={entry.label} checked={kindsOf(set).includes(entry.kind)} disabled={busy} onchange={(on) => onchange(withKind(set, entry.kind, on))} />
        <span>{entry.label}</span>
      </label>
    {/each}
  </div>
  <p class="minus">Minus</p>
  <div class="rule">
    {#each KINDS as entry (entry.kind)}
      <label class="toggle">
        <PanelToggle label={`Exclude ${entry.label}`} checked={excludedKindsOf(set).includes(entry.kind)} disabled={busy} onchange={(on) => onchange(withExcludedKind(set, entry.kind, on))} />
        <span>{entry.label}</span>
      </label>
    {/each}
  </div>
{/snippet}

<Panel title="Contexts">
  {#snippet actions()}
    <PanelButton label="New set" icon={Plus} tone={creating ? "default" : "primary"} disabled={busy} onclick={() => (creating = !creating)} />
  {/snippet}

  {#if actionError}
    <PanelBanner title="That did not happen" tone="attention">{actionError}</PanelBanner>
  {/if}

  {#if creating}
    <PanelSection title="New set" chevron="end">
      <div class="add">
        <PanelInput label="Set name" placeholder={nextSetName(sets)} flush bind:value={nameDraft} onenter={create} />
        <PanelButton label="Create" tone="primary" disabled={busy} onclick={create} />
      </div>
      {@render rule(draft, (next) => (draft = next))}
      <PanelNote>{ruleOf(draft, names)}.</PanelNote>
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
    <PanelSearch placeholder="Filter sets…" matched={shown.length} total={sets.length} flush bind:value={query}>
      {#each shown as set (set.id)}
        <div class="set">
          <PanelSection title={set.name} count={countOf(set)} open={false} chevron="end">
            <PanelFields>
              <PanelField label="Name" stacked>
                <PanelEditableText value={set.name} label={`Name of ${set.name}`} disabled={busy} onchange={(next) => rename(set, next)} />
              </PanelField>
              <PanelField label="Description" stacked>
                <PanelEditableText value={set.description ?? ""} label={`Description of ${set.name}`} placeholder="What this set is for" multiline disabled={busy} onchange={(next) => describe(set, next)} />
              </PanelField>
              <PanelField label="Rule" stacked>{ruleOf(set.set, names)}</PanelField>
              <PanelField label="Selects now" mono>{countOf(set)}</PanelField>
              <PanelField label="Created by">{set.createdByName}</PanelField>
            </PanelFields>
            {#if set.resolves === 0}
              <PanelNote tone="gap">A set that matches nothing widens a prompt to the whole project rather than narrowing it to nothing.</PanelNote>
            {/if}
            {@render rule(set.set, (next) => change(set, next))}
            <div class="remove">
              <PanelButton label="Delete set" tone="danger" disabled={busy} title={`Delete “${set.name}” — refused while another set or a template still names it`} onclick={() => remove(set)} />
            </div>
          </PanelSection>
        </div>
      {/each}
    </PanelSearch>
  {/if}
  <PanelNote>Counts are resolved when this panel reads, never stored. <Target size={12} aria-hidden="true" /></PanelNote>
</Panel>

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
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: calc(var(--token-spacing-unit) * 1) calc(var(--token-spacing-unit) * 2);
    margin: calc(var(--token-spacing-unit) * 2) 0;
  }

  .minus {
    margin: 0;
    color: var(--token-ink-muted);
    font-size: var(--token-text-caption);
    line-height: var(--token-text-caption-leading);
    font-weight: 500;
  }

  .toggle {
    display: flex;
    min-width: 0;
    align-items: center;
    gap: calc(var(--token-spacing-unit) * 1.5);
    color: var(--token-ink-secondary);
    font-size: var(--token-text-caption);
    line-height: var(--token-text-caption-leading);
  }

  .toggle span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .remove {
    display: flex;
    margin-top: calc(var(--token-spacing-unit) * 2);
  }
</style>
