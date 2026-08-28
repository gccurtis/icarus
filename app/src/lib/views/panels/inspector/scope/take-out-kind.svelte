<script lang="ts">
  import ArrowLeftRight from "@lucide/svelte/icons/arrow-left-right";
  import X from "@lucide/svelte/icons/x";

  import {
    Panel,
    PanelActions,
    PanelButton,
    PanelCrumbs,
    PanelField,
    PanelFields,
    PanelNote,
    PanelRow,
    PanelSection
  } from "$components/authored/panel";
  import { Separator } from "$lib/components/vendor/separator";
  import { context, kindTerm } from "$capabilities/scope";
  import { viewState } from "$model/client/view-state";

  /**
   * A kind term on Take out: a live rule removing everything of one kind.
   *
   * `docs/screen-panel-views/inspector/scope/take-out-kind.md` is the
   * specification.
   *
   * **The count is what this term removes from this Context**, not how many
   * resources of that kind the project holds. The two differ whenever Include is
   * narrower than the project, and only the first tells anyone anything.
   *
   * **The sample says how many of how many.** A section that shows four of
   * thirty-seven and reports a bare four claims the sample is the whole.
   */
  let {
    contextId = "cx-drafts",
    termId = "tm-templates"
  }: { contextId?: string; termId?: string } = $props();

  const view = viewState();

  const scope = $derived(context(contextId).current);
  const term = $derived(kindTerm(termId).current);

  /** Which half it sits on, after any flip made here. */
  let moved = $state(false);

  const half = $derived(moved ? "Include" : "Take out");
  const other = $derived(moved ? "Take out" : "Include");

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
        view.inspect("scope.context", { kind: "context", id: contextId })}
    />
  {/snippet}

  {#snippet actions()}
    <PanelButton
      label="Move to {other}"
      icon={ArrowLeftRight}
      title="Put this term on the {other} half"
      onclick={() => (moved = !moved)}
    />
  {/snippet}

  <PanelSection title="Rule">
    <PanelFields>
      <PanelField label="In words" stacked>{term.ruleInWords}</PanelField>
    </PanelFields>
    <PanelNote>
      Live, like every other term. A {term.kind} created tomorrow is taken out
      too.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Right now">
    <PanelFields>
      <PanelField label="Takes out" mono>{term.takesOut}</PanelField>
    </PanelFields>
    <PanelNote>
      What this term removes from this Context — not how many the project holds.
    </PanelNote>
  </PanelSection>

  <!--
    A sample of what disappears, so a rule doing more than intended is visible.
    Rows without `onselect`: the resolve returns names, and a row that looks like
    a target and opens nothing is worse than a row that does not.
  -->
  <PanelSection
    title="What that removes"
    count="{term.sample.length} of {term.takesOut}"
    open={false}
    flush
  >
    {#each term.sample as removed (removed)}
      <PanelRow title={removed} />
    {/each}
  </PanelSection>

  <Separator />

  <PanelActions>
    <PanelButton label="Remove" icon={X} tone="danger" onclick={() => view.clear()} />
  </PanelActions>
</Panel>
