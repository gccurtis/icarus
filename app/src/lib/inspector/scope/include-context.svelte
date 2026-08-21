<script lang="ts">
  import ExternalLink from "@lucide/svelte/icons/external-link";
  import X from "@lucide/svelte/icons/x";

  import {
    Panel,
    PanelActions,
    PanelButton,
    PanelChip,
    PanelCrumbs,
    PanelField,
    PanelFields,
    PanelNote,
    PanelSection
  } from "$lib/unique-components/panel";
  import { Separator } from "$lib/simple-components/separator";
  import { context, contextTerm } from "$mock-capabilities/scope";
  import { mockWorkbench } from "$mock-models/workbench.svelte";

  /**
   * A reference to another saved Context, on either half.
   *
   * `docs/screen-panel-views/inspector/scope/include-context.md` is the
   * specification.
   *
   * **A reference, not a copy.** What it contributes is whatever the referenced
   * Context contains at the moment this one is read, so editing that one edits
   * this one — which is why *Right now* carries the cycle check beside the
   * count.
   */
  let {
    contextId = "cx-drafts",
    termId = "tm-corpus"
  }: { contextId?: string; termId?: string } = $props();

  const scope = $derived(context(contextId).current);
  const term = $derived(contextTerm(termId).current);

  const half = $derived(term.side === "include" ? "Include" : "Take out");

  const trail = $derived([
    { label: scope.name, key: "context" },
    { label: half },
    { label: term.label }
  ]);
</script>

<Panel title={term.label}>
  {#snippet crumbs()}
    <PanelCrumbs
      {trail}
      onnavigate={() =>
        mockWorkbench.inspect("scope.context", { kind: "context", id: contextId })}
    />
  {/snippet}

  {#snippet actions()}
    <PanelButton
      label="Open that Context"
      icon={ExternalLink}
      title="Switch the inspector to {term.label}"
      onclick={() =>
        mockWorkbench.inspect("scope.context", { kind: "context", id: term.referencedId })}
    />
  {/snippet}

  <PanelSection title="Rule">
    <PanelFields>
      <PanelField label="In words" stacked>{term.ruleInWords}</PanelField>
    </PanelFields>
    <PanelNote>
      A reference, not a copy. Editing {term.label} changes this Context too.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Right now">
    <PanelFields>
      <PanelField label="Matches" mono>{term.matches}</PanelField>
      <PanelField label="Circular">
        <!-- Coloured only when it is a problem: a green "No" is a state nobody needs. -->
        {#if term.circular}
          <PanelChip tone="danger">Yes</PanelChip>
        {:else}
          No
        {/if}
      </PanelField>
    </PanelFields>
    <PanelNote tone="gap">
      The cycle is checked when the reference is read. Until it is checked at
      save time as well, a Context can be saved into a state that fails only
      when something tries to use it.
    </PanelNote>
  </PanelSection>

  <!-- How deep the reference goes: context for the count above, so it starts shut. -->
  <PanelSection title="Chain" open={false}>
    <PanelFields>
      <PanelField label="Depth">{term.chain.length} levels</PanelField>
      <PanelField label="Through" stacked>{term.chain.join(" → ")}</PanelField>
    </PanelFields>
    <PanelNote tone="gap">
      Chain depth needs a limit. Three is readable; six is not, and this panel
      has no way to draw it.
    </PanelNote>
  </PanelSection>

  <Separator />

  <PanelActions>
    <PanelButton label="Remove" icon={X} tone="danger" onclick={() => mockWorkbench.clear()} />
  </PanelActions>
</Panel>
