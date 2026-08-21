<script lang="ts">
  import ExternalLink from "@lucide/svelte/icons/external-link";
  import Library from "@lucide/svelte/icons/library";

  import { Panel, PanelButton, PanelRow, PanelSection } from "$lib/unique-components/panel";
  import { contextsFor, resolvedPreview, type ScopeInUse } from "$mock-capabilities/resource";
  import { mockWorkbench } from "$mock-models/workbench.svelte";

  /**
   * What the prompt blocks in this document can look up.
   *
   * `docs/screen-panel-views/context/resource/context-document.md` is the
   * specification. A prompt block generates against a scope; this is where the
   * scopes and their current contents are seen without leaving the document.
   *
   * **The title picks assignable.** The specification leaves open whether this
   * lists only the scopes blocks here already use or every saved Context, and
   * says the title has to choose. "Available to prompt blocks" is the second, so
   * every saved Context is listed and each row says whether a block here uses it.
   *
   * **Editing happens on the Context screen.** There is nothing here that changes
   * a scope's membership — a scope edited from inside one document is a scope
   * edited without seeing what else runs against it.
   */
  let {
    documentId = "r-memo",
    onopenscreen
  }: { documentId?: string; onopenscreen?: () => void } = $props();

  const scopes = $derived(contextsFor(documentId).current);

  let scopeId = $state("sc-field");

  const selected = $derived(scopes.find((scope) => scope.id === scopeId) ?? scopes[0]);
  const sample = $derived(resolvedPreview(selected.id).current);

  const usage = (scope: ScopeInUse) =>
    scope.usedByBlocks === 0
      ? "Not used by a block here"
      : scope.usedByBlocks === 1
        ? "Used by 1 prompt block"
        : `Used by ${scope.usedByBlocks} prompt blocks`;

  const choose = (scope: ScopeInUse) => {
    scopeId = scope.id;
    mockWorkbench.inspect("scope.context", { kind: "scope", id: scope.id });
  };
</script>

<Panel title="Context">
  {#snippet actions()}
    <PanelButton label="Open Context screen" icon={ExternalLink} onclick={onopenscreen} />
  {/snippet}

  <PanelSection title="Available to prompt blocks" count={scopes.length} flush>
    {#each scopes as scope (scope.id)}
      <PanelRow
        title={scope.name}
        sub={usage(scope)}
        meta="{scope.resolves} resources"
        icon={Library}
        selected={scope.id === selected.id}
        onselect={() => choose(scope)}
      />
    {/each}
  </PanelSection>

  <!--
    A sample rather than the set: the resolve is bounded server-side, so the
    count says "of 96" and never claims these four are all of it. Shut on
    arrival, because the question it answers — has this scope drifted — is asked
    before a run, not on every visit.
  -->
  <PanelSection title="Resolved preview" count="of {selected.resolves}" open={false} flush>
    {#each sample as member (member.id)}
      <PanelRow
        title={member.name}
        meta={member.kind}
        onselect={() =>
          mockWorkbench.inspect("scope.resolved-resource", { kind: "resource", id: member.id })}
      />
    {/each}
  </PanelSection>
</Panel>
