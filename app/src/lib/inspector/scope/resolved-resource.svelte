<script lang="ts">
  import CircleMinus from "@lucide/svelte/icons/circle-minus";
  import ExternalLink from "@lucide/svelte/icons/external-link";

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
  import { context, resolvedResource } from "$mock-capabilities/scope";
  import { viewState } from "$model/client/view-state";

  /**
   * One resource that survived the rule, and the proof of why it did.
   *
   * `docs/screen-panel-views/inspector/scope/resolved-resource.md` is the
   * specification. The row that makes a Context debuggable: everything else says
   * what the rule is, and this says what the rule did to one thing.
   *
   * **A connector expands to the files it synced.** Where a row arrived through
   * one, the proof names the connector as the step and not as the content — the
   * connector record itself is never retrievable.
   *
   * **Add to Take out is the one-click escape** from a rule that caught
   * something it should not have. It adds a named term to the other half rather
   * than editing this resource, so the rule stays the thing that decides.
   */
  let {
    contextId = "cx-drafts",
    resourceId = "sp-feeder-12-relay"
  }: { contextId?: string; resourceId?: string } = $props();

  const view = viewState();

  const scope = $derived(context(contextId).current);
  const row = $derived(resolvedResource(contextId, resourceId).current);

  /** Something that came through a connector is not a resource of this project. */
  const kind = $derived(row.via === undefined ? row.kind : `external ${row.kind}`);

  /** The term added here, held locally: the door is a read. */
  let takenOut = $state(false);

  const trail = $derived([
    { label: scope.name, key: "context" },
    { label: "Contents" },
    { label: row.name }
  ]);
</script>

<Panel title={row.name}>
  {#snippet crumbs()}
    <PanelCrumbs
      {trail}
      onnavigate={() =>
        view.inspect("scope.context", { kind: "context", id: contextId })}
    />
  {/snippet}

  {#snippet actions()}
    <PanelButton
      label="Open"
      icon={ExternalLink}
      onclick={() =>
        view.inspect("project.resource", { kind: "resource", id: row.id })}
    />
  {/snippet}

  <!-- The first band carries no heading: the panel's title already names it. -->
  <PanelFields>
    <PanelField label="Title" stacked>{row.name}</PanelField>
    <PanelField label="Kind">{kind}</PanelField>
    <PanelField label="Updated">{row.updated}</PanelField>
  </PanelFields>

  <PanelSection title="In because">
    <PanelFields>
      <PanelField label="Term">{row.inBecause}</PanelField>
      {#if row.via}
        <PanelField label="Via">{row.via}</PanelField>
      {/if}
      <PanelField label="In words" stacked>{row.whyInWords}</PanelField>
    </PanelFields>

    {#if row.via}
      <PanelNote>
        A connector expands to the files it synced. The connector record itself
        is never retrievable content.
      </PanelNote>
    {/if}

    <PanelNote tone="gap">
      The proof comes from the resolver. Reconstructed here instead, the
      explanation for a nested reference would be guesswork.
    </PanelNote>
  </PanelSection>

  <!-- Whether anything in it can actually be searched: the qualifier, so it starts shut. -->
  <PanelSection title="Retrievable" open={false}>
    <PanelFields>
      <PanelField label="Indexed regions">
        {#if row.indexedRegions === 0}
          <PanelChip tone="attention">None</PanelChip>
        {:else}
          {row.indexedRegions}
        {/if}
      </PanelField>
    </PanelFields>
    {#if row.indexedRegions === 0}
      <PanelNote>
        In the scope, and nothing in it can be retrieved. A search over this
        Context will never return a passage from here.
      </PanelNote>
    {/if}
  </PanelSection>

  <PanelSection title="Take this one out">
    <PanelActions>
      <PanelButton
        label={takenOut ? "Added to Take out" : "Add to Take out"}
        icon={CircleMinus}
        disabled={takenOut}
        title="Adds a named term for {row.name} to the Take out half"
        onclick={() => (takenOut = true)}
      />
    </PanelActions>
    <PanelNote>
      The escape from a rule that caught something it should not have. It adds a
      named term to Take out; the rule above is left as it was written.
    </PanelNote>
  </PanelSection>
</Panel>
