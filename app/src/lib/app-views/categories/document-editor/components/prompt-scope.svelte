<script lang="ts">
  import { PanelButton } from "$authored-components/panel";
  import { OverlayModal } from "$authored-components/overlay";
  import { ScopeBuilder } from "$authored-components/scope-builder";
  import {
    builderView,
    defaultScopeOf,
    draftOf,
    narrowed,
    offeringOf,
    projectResources,
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
    type ScopeDraft,
    type ScopeSide
  } from "$app-views/categories/document-editor/procedures/templating";
  import { blockIn } from "$app-views/categories/document-editor/procedures/blocks";
  import { workspaceState, type DocumentRuntime } from "$model/client/workspace-state";

  /**
   * What a prompt reads, wherever the prompt is.
   *
   * The same control answers for a block that has not generated yet and for one
   * already linked to its output, so the two can never say different things.
   */
  let {
    blockId,
    disabled = false,
    description = "The sources it is answered from. If it is a hole, this is also what the hole selects until whoever places the template says otherwise.",
    onconfirm
  }: {
    blockId: string;
    disabled?: boolean;
    description?: string;
    onconfirm: (next: unknown) => void;
  } = $props();

  const view = workspaceState();
  const documentId = $derived(view.active.resourceId);

  let runtime = $state<DocumentRuntime>();
  $effect(() => {
    runtime = documentId === undefined ? undefined : view.documentRuntime(documentId);
  });

  const held = $derived(
    runtime?.body === undefined ? undefined : blockIn(runtime.body, blockId)
  );
  const scope = $derived(held?.type === "prompt" ? held.scope : undefined);

  const sets = resourceSets();
  const index = projectResources();
  const setItems = $derived(setsIn(sets.ready ? sets.current : undefined));
  const catalogue = $derived(resourcesIn(index.ready ? index.current : undefined));
  const setNames = $derived(scopeNamesOf(setItems, catalogue));
  const offering = $derived(offeringOf(setItems, catalogue));
  const reads = $derived(ruleOf(defaultScopeOf(scope), setNames));

  let open = $state(false);
  let draft = $state<ScopeDraft>(draftOf(undefined));
  const view$ = $derived(builderView(draft, offering));
  const blocked = $derived(
    draft.include.length === 0 ? "Include something, or choose everything in the project." : undefined
  );

  const start = () => {
    draft = draftOf(scope);
    open = true;
  };

  const confirm = () => {
    onconfirm(narrowed(draft) ?? draft);
    open = false;
  };
</script>

<div class="scope">
  <span>Scope</span>
  <div class="scope-control">
    <PanelButton label={reads} {disabled} title="Choose what this prompt reads" onclick={start} />
  </div>
</div>

<OverlayModal
  bind:open
  title="What this prompt reads"
  {description}
  confirm="Set the scope"
  width="wide"
  {blocked}
  onconfirm={confirm}
>
  <ScopeBuilder
    {...view$}
    onmode={(whole) => (draft = whole ? withWholeProject() : { include: [], exclude: [] })}
    onadd={(side: ScopeSide, source: string, key: string) => {
      const term = termFor(source as OfferSource, key);
      if (term !== undefined) draft = withTerm(draft, side, term);
    }}
    ondrop={(side: ScopeSide, key: string) => (draft = withoutTerm(draft, side, key))}
    onclear={() => (draft = { include: [], exclude: [] })}
  />
</OverlayModal>

<style>
  .scope {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: calc(var(--token-spacing-unit) * 2);
    min-height: 2rem;
  }

  .scope span {
    color: var(--token-ink-muted);
    font-size: var(--token-text-caption);
    line-height: var(--token-text-caption-leading);
    font-weight: 600;
  }

  .scope-control {
    width: 9.25rem;
  }
</style>
