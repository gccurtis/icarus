<script lang="ts">
  import { onDestroy } from "svelte";
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
  import {
    builderView,
    changeSet,
    createSet,
    describeSet,
    draftOf,
    narrowed,
    nextSetName,
    offeringOf,
    projectResources,
    removeSet,
    renameSet,
    resourceSets,
    resourcesIn,
    ruleOf,
    scopeNamesOf,
    setsIn,
    termFor,
    withTerm,
    withWholeProject,
    withoutTerm,
    type OfferSource,
    type ResourceSetItem,
    type ScopeDraft,
    type ScopeSide
  } from "$app-views/categories/project-overview/procedures/contexts";
  import { workspaceState } from "$model/client/workspace-state";

  const view = workspaceState();
  let live = true;
  onDestroy(() => {
    live = false;
  });

  const answer = resourceSets();
  const index = projectResources();
  const sets = $derived(setsIn(answer.ready ? answer.current : undefined));
  const catalogue = $derived(resourcesIn(index.ready ? index.current : undefined));
  const names = $derived(scopeNamesOf(sets, catalogue));

  let query = $state("");
  let creating = $state(false);
  let nameDraft = $state("");
  let draft = $state<ScopeDraft>(withWholeProject());
  let editing = $state<ResourceSetItem | undefined>(undefined);
  let builderOpen = $state(false);
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
      const rule = narrowed(draft);
      if (rule === undefined) return;
      const name = nameDraft.trim() || nextSetName(sets);
      await createSet(view, name, rule);
      if (!live) return;
      creating = false;
      nameDraft = "";
      draft = withWholeProject();
    });

  const change = (item: ResourceSetItem) =>
    run(`change:${item.id}`, async () => {
      const rule = narrowed(draft);
      if (rule === undefined) return;
      const result = await changeSet(view, item, rule);
      if (live && !result.accepted) actionError = result.detail;
    });

  /** One builder, opened either on the set being made or on one that exists. */
  const openBuilder = (item?: ResourceSetItem) => {
    editing = item;
    draft = draftOf(item?.set ?? draft);
    builderOpen = true;
  };

  const confirmBuilder = () => {
    const item = editing;
    if (item !== undefined) void change(item);
    editing = undefined;
  };

  const offering = $derived(offeringOf(sets, catalogue, editing?.id));
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

  const scopeBlocked = $derived(
    draft.include.length === 0 ? "Include something, or choose the whole project." : undefined
  );

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
      <div class="rule">
        <PanelNote>{ruleOf(draft, names)}.</PanelNote>
        <PanelButton
          label="Choose what it selects"
          disabled={busy}
          title="Open the builder on this set"
          onclick={() => openBuilder()}
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
            <div class="remove">
              <PanelButton
                label="Change what it selects"
                disabled={busy}
                title={`Open the builder on “${set.name}”`}
                onclick={() => openBuilder(set)}
              />
              <PanelButton label="Delete set" tone="danger" disabled={busy} title={`Delete “${set.name}” — refused while another set or a template still names it`} onclick={() => remove(set)} />
            </div>
          </PanelSection>
        </div>
      {/each}
    </PanelSearch>
  {/if}
  <PanelNote>Counts are resolved when this panel reads, never stored. <Target size={12} aria-hidden="true" /></PanelNote>
</Panel>

<OverlayModal
  bind:open={builderOpen}
  title={editing === undefined ? "A set of resources" : `What “${editing.name}” selects`}
  description="A set is a rule, resolved when it is read. Everything a prompt or a template variable can be answered with is built here."
  confirm={editing === undefined ? "Use this" : "Save"}
  width="narrow"
  blocked={scopeBlocked}
  onconfirm={confirmBuilder}
>
  <ScopeBuilder {...view$} onmode={setMode} onadd={addTerm} ondrop={dropTerm} />
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
