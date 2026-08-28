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
    PanelSection
  } from "$components/authored/panel";
  import { Separator } from "$lib/components/vendor/separator";
  import { context, everythingTerm } from "$capabilities/scope";
  import { viewState } from "$model/client/view-state";

  /**
   * The "Everything in this project" term: the broadest rule there is.
   *
   * `docs/screen-panel-views/inspector/scope/include-everything.md` is the
   * specification. Most Contexts start here and narrow with Take out.
   *
   * **The "including anything created later" clause is the whole term** and is
   * stated rather than left implicit — it is the difference between a rule and a
   * snapshot of today's project.
   *
   * **Move flips a local half, Remove clears the inspection.** The door is a
   * read, so the flip is held here; removing the term removes the thing this
   * lens is about, and a lens whose subject is gone has nothing to show.
   */
  let {
    contextId = "cx-drafts",
    termId = "tm-everything"
  }: { contextId?: string; termId?: string } = $props();

  const view = viewState();

  const scope = $derived(context(contextId).current);
  const term = $derived(everythingTerm(termId).current);

  /** Which half it sits on, after any flip made here. */
  let moved = $state(false);

  const half = $derived(moved ? "Take out" : "Include");
  const other = $derived(moved ? "Include" : "Take out");

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
      Live. A resource made after this Context was saved is inside it, without
      anyone editing the rule.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Right now">
    <PanelFields>
      <PanelField label="Matches" mono>{term.matches}</PanelField>
    </PanelFields>
  </PanelSection>

  <!--
    Containing a resource and being able to retrieve from it are different
    things, and this is the qualifier rather than the reason the lens was
    opened — so it arrives shut.
  -->
  <PanelSection title="Retrievable" open={false}>
    <PanelFields>
      <PanelField label="Indexed" mono>{term.indexed}</PanelField>
      <PanelField label="Nothing indexed" mono>{term.nothingIndexed}</PanelField>
    </PanelFields>
    <PanelNote tone="gap">
      Nothing upstream separates <em>not processed yet</em> from
      <em>cannot be processed</em>, and those want different responses.
    </PanelNote>
  </PanelSection>

  <Separator />

  <PanelActions>
    <PanelButton label="Remove" icon={X} tone="danger" onclick={() => view.clear()} />
  </PanelActions>

  <PanelNote tone="gap">
    Everything in this project on Take out empties the Context by construction.
    Whether that is refused or allowed is undecided — it is the one composition
    that produces a zero-member scope on purpose.
  </PanelNote>
</Panel>
