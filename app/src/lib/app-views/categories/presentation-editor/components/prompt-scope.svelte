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
  } from "$app-views/categories/presentation-editor/procedures/templating";
  import {
    promptBlockIn,
    type Id
  } from "$app-views/categories/presentation-editor/procedures/prompt-blocks";
  import { readPromptOutput } from "$app-views/categories/presentation-editor/procedures/read-prompt-output";
  import { confirmPromptScope } from "$app-views/categories/presentation-editor/procedures/confirm-prompt-scope";
  import { workspaceState } from "$model/client/workspace-state";

  /**
   * What a prompt reads, read from whichever thing owns it.
   *
   * A linked prompt keeps no scope of its own — the derived output is the scope,
   * and one write changes it. An unlinked one has no output yet, so the block
   * holds it until there is somewhere better. Either way there is exactly one
   * of it, so the panel and the agent cannot come to disagree.
   */
  let {
    blockId,
    derivedOutputId,
    disabled = false,
    description = "The sources it is answered from. If it is a hole, this is also what the hole selects until whoever places the template says otherwise.",
    onconfirm
  }: {
    blockId: string;
    derivedOutputId?: string;
    disabled?: boolean;
    description?: string;
    onconfirm: (next: unknown) => void | Promise<void>;
  } = $props();

  const view = workspaceState();
  const presentationId = view.active.resourceId;

  const runtime = presentationId === undefined ? undefined : view.presentationRuntime(presentationId);

  // One control belongs to one immutable Derived Output identity; the parent keys it.
  // svelte-ignore state_referenced_locally
  const outputQuery =
    derivedOutputId === undefined
      ? undefined
      : readPromptOutput(derivedOutputId as Id<"derivedOutputs">);
  const linked = $derived(outputQuery?.ready ? outputQuery.current?.output : undefined);

  const scope = $derived(
    derivedOutputId === undefined
      ? runtime?.body === undefined
        ? undefined
        : promptBlockIn(runtime.body, blockId)?.scope
      : linked?.scope
  );

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

  const confirm = () => confirmPromptScope({
    close: () => (open = false),
    confirm: onconfirm,
    refresh: outputQuery === undefined ? undefined : () => outputQuery.refresh(),
    value: narrowed(draft) ?? draft
  });
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
