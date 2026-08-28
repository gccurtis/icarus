<script lang="ts">
  import Globe from "@lucide/svelte/icons/globe";
  import Search from "@lucide/svelte/icons/search";

  import {
    Panel,
    PanelField,
    PanelFields,
    PanelNote,
    PanelRow,
    PanelSection
  } from "$components/authored/panel";
  import { searchScope } from "$capabilities/research";
  import { contexts } from "$capabilities/scope";
  import { viewState } from "$model/client/view-state";

  /**
   * What this thread can search, and what that came to when it last resolved.
   *
   * `docs/screen-panel-views/context/research/context.md` is the specification.
   * The scope is set once for the thread and there is no per-turn switch, so this
   * panel states facts and carries no controls: a control here would offer a
   * change the model has nowhere to put.
   *
   * **The thread names its scope rather than referencing it.** The saved Context
   * is matched by name so the row can open its definition; where no saved Context
   * carries that name the row is inert rather than a link that leads nowhere. The
   * counts are the thread's own resolution throughout — the Context's stored
   * counts are a different resolution and mixing the two would print two answers
   * to one question.
   */
  let { threadId = "th-feeder" }: { threadId?: string } = $props();

  const view = viewState();

  const scope = $derived(searchScope(threadId).current);
  const saved = $derived(contexts().current.find((row) => row.name === scope.name));

  const openSaved = $derived(
    saved === undefined
      ? undefined
      : () => view.inspect("scope.context", { kind: "context", id: saved.id })
  );
</script>

<Panel title="Context">
  <PanelSection title="This thread searches" flush>
    <PanelRow
      title={scope.name}
      sub="{scope.resources} resources"
      icon={Search}
      onselect={openSaved}
    />

    <!-- The web is a second place to look, not a resource in the set. -->
    <PanelRow
      title="The web"
      sub={scope.web ? "Enabled for this thread" : "Not available to this thread"}
      icon={Globe}
      tone={scope.web ? "intelligence" : "default"}
    />
  </PanelSection>

  <!--
    Contained and indexed are two numbers rather than one percentage: holding a
    resource and being able to retrieve a passage from it are different things,
    and the gap between them is the number worth reading.
  -->
  <PanelSection title="Resolution">
    <PanelFields>
      <PanelField label="Resolved" mono>{scope.resources} resources</PanelField>
      <PanelField label="Indexed" mono>
        {scope.indexed} · {scope.withoutMaterial} with no material
      </PanelField>
      <PanelField label="At" mono>{scope.resolvedAt}</PanelField>
    </PanelFields>
  </PanelSection>

  <PanelSection title="Warning">
    {#if scope.unbounded}
      <PanelNote tone="gap">
        This thread's scope resolves to nothing, so every turn is searching the
        whole lattice.
      </PanelNote>
    {:else}
      <PanelNote>
        A scope that is absent, or that resolves to nothing, searches the whole
        lattice rather than nothing at all.
      </PanelNote>
      <PanelNote tone="gap">
        Nothing blocks that yet. A zero-member Context has to be refused where it
        is saved, or the widest possible search is the silent result of the
        narrowest possible rule.
      </PanelNote>
    {/if}
  </PanelSection>
</Panel>
