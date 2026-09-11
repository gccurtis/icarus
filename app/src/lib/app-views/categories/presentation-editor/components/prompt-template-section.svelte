<script lang="ts">
  import { PromptTemplate } from "$authored-components/prompt-template";
  import {
    promptBlockIn,
    promptHoleOps,
    type Id
  } from "$app-views/categories/presentation-editor/procedures/prompt-blocks";
  import {
    defaultScopeOf,
    nextHoleName,
    projectResources,
    resourceSets,
    resourcesIn,
    ruleOf,
    scopeNamesOf,
    setsIn
  } from "$app-views/categories/presentation-editor/procedures/templating";
  import { readPromptOutput } from "$app-views/categories/presentation-editor/procedures/read-prompt-output";
  import { workspaceState } from "$model/client/workspace-state";
  import type { PresentationOp } from "$representation/data/types/presentations/op";

  /**
   * Turning a prompt into a hole, and saying what the hole is.
   *
   * What the hole would default to is the scope the prompt reads, and once the
   * prompt is linked that lives on the derived output. This reads it from the
   * same place the agent does, so the default shown here is the default a
   * template would actually carry.
   */
  let {
    blockId,
    derivedOutputId,
    disabled = false
  }: {
    blockId: string;
    derivedOutputId?: string;
    disabled?: boolean;
  } = $props();

  const view = workspaceState();
  const presentationId = view.active.resourceId;

  const runtime = presentationId === undefined ? undefined : view.presentationRuntime(presentationId);

  const body = $derived(runtime?.body);
  const block = $derived(body === undefined ? undefined : promptBlockIn(body, blockId));

  // One section belongs to one immutable Derived Output identity; the parent keys it.
  // svelte-ignore state_referenced_locally
  const outputQuery =
    derivedOutputId === undefined
      ? undefined
      : readPromptOutput(derivedOutputId as Id<"derivedOutputs">);
  const linked = $derived(outputQuery?.ready ? outputQuery.current?.output : undefined);

  const sets = resourceSets();
  const index = projectResources();
  const setNames = $derived(
    scopeNamesOf(
      setsIn(sets.ready ? sets.current : undefined),
      resourcesIn(index.ready ? index.current : undefined)
    )
  );

  const offered = $derived(body === undefined ? "Hole 1" : nextHoleName(body));
  const named = $derived(block?.hole);
  const reads = $derived(
    ruleOf(defaultScopeOf(derivedOutputId === undefined ? block?.scope : linked?.scope), setNames)
  );

  const write = (ops: readonly PresentationOp[]) => {
    if (runtime === undefined || ops.length === 0) return;
    runtime.apply(ops);
  };

  const make = () => {
    if (block === undefined) return;
    write(promptHoleOps(block, { name: offered }));
  };

  const rename = (name: string) => {
    if (block === undefined) return;
    write(promptHoleOps(block, { name, description: named?.description }));
  };

  const describe = (description: string) => {
    if (block === undefined) return;
    write(promptHoleOps(block, { name: named?.name ?? offered, description }));
  };
</script>

<PromptTemplate
  name={named?.name}
  description={named?.description ?? ""}
  {offered}
  standing={reads}
  {disabled}
  onmake={make}
  onname={rename}
  ondescription={describe}
/>
