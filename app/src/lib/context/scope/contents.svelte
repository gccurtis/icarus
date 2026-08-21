<script lang="ts">
  import CircleMinus from "@lucide/svelte/icons/circle-minus";
  import CirclePlus from "@lucide/svelte/icons/circle-plus";
  import FileText from "@lucide/svelte/icons/file-text";
  import TriangleAlert from "@lucide/svelte/icons/triangle-alert";

  import { Panel, PanelNote, PanelRow, PanelSection } from "$lib/unique-components/panel";
  import {
    contentsOf,
    context,
    problemsIn,
    unsavedChangesIn,
    type ResolvedResource
  } from "$mock-capabilities/scope";
  import { mockWorkbench } from "$mock-models/workbench.svelte";

  /**
   * What survives the rule, with anything unsaved or broken above it.
   *
   * `docs/screen-panel-views/context/scope/contents.md` is the specification.
   * Problems and pending edits come first because both change what the list
   * below them means.
   *
   * **A broken term is kept exactly as it was written.** Repairing one silently
   * would make the term vanish and the count move with no explanation, so the
   * resolver's failure is a row rather than an absence.
   *
   * **Every row says why it is there.** A Context stores no membership — this is
   * a resolve, not a lookup — so without the term that put a row here there is
   * nothing to check a surprising result against.
   */
  let { contextId = "cx-drafts" }: { contextId?: string } = $props();

  const scope = $derived(context(contextId).current);
  const problems = $derived(problemsIn(contextId).current);
  const pending = $derived(unsavedChangesIn(contextId).current);
  const rows = $derived(contentsOf(contextId).current);

  /** The term that put a row here, named through whatever it came through. */
  const why = (row: ResolvedResource) =>
    row.via === undefined
      ? `In because · ${row.inBecause}`
      : `In because · ${row.inBecause}, via ${row.via}`;
</script>

<Panel title="Contents">
  {#if problems.length > 0}
    <!--
      No row here is a target: a term the resolver could not do names something
      there is nothing to open.
    -->
    <PanelSection title="Problems" count={problems.length} flush>
      {#each problems as problem (problem.id)}
        <PanelRow
          title={problem.title}
          sub={problem.term}
          icon={TriangleAlert}
          tone={problem.tone}
        />
        <PanelNote>{problem.detail}</PanelNote>
      {/each}

      <PanelNote tone="gap">
        What a broken term should do — fail, omit it, or come back as an
        unresolved descriptor — is not settled, so a problem here is reported
        rather than handled.
      </PanelNote>
    </PanelSection>
  {/if}

  {#if pending.length > 0}
    <PanelSection title="Unsaved changes" count={pending.length} flush>
      {#each pending as change (change.id)}
        <PanelRow
          title={change.name}
          sub={change.because}
          meta={change.effect === "added" ? "Would be added" : "Would be taken out"}
          icon={change.effect === "added" ? CirclePlus : CircleMinus}
          tone={change.effect === "added" ? "success" : "attention"}
        />
      {/each}

      <PanelNote>
        None of this is live yet. Other things read this Context, so what is set
        up and what is saved stay two visible states until it is saved.
      </PanelNote>
    </PanelSection>
  {/if}

  <PanelSection title="Contents" count="{rows.length} of {scope.contains}" flush>
    {#each rows as row (row.id)}
      <PanelRow
        title={row.name}
        sub={why(row)}
        meta={row.updated}
        icon={FileText}
        onselect={() =>
          mockWorkbench.inspect("scope.resolved-resource", { kind: "resource", id: row.id })}
      />
    {/each}

    <PanelNote>
      Resolved now, a page at a time. {scope.contains} survive the rule today, and
      a resource made tomorrow that fits it will be here without anyone editing
      anything.
    </PanelNote>
    <PanelNote tone="gap">
      In because comes from the resolver, one proof per result. Reconstructed
      here instead, the reason a row survived a nested reference would be a
      guess.
    </PanelNote>
  </PanelSection>
</Panel>
