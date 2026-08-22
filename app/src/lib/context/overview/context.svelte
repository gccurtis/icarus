<script lang="ts">
  import Copy from "@lucide/svelte/icons/copy";
  import Trash2 from "@lucide/svelte/icons/trash-2";

  import {
    Panel,
    PanelButton,
    PanelChip,
    PanelEditableText,
    PanelField,
    PanelFields,
    PanelNote,
    PanelRow,
    PanelSection
  } from "$lib/unique-components/panel";
  import {
    context,
    retrievabilityOf,
    searchIn,
    usedBy,
    type Dependent
  } from "$mock-capabilities/scope";
  import { viewState } from "$model/client/view-state";

  const view = viewState();

  /**
   * This Context: what it is, what it currently resolves to, whether it is
   * saved.
   *
   * `docs/screen-panel-views/context/overview/context.md` is the specification.
   *
   * **The two numbers under *Right now* are the point.** 211 resources of which
   * 88 are retrievable is a very different scope from 211 of which 211 are, so
   * contained and retrievable are separate rows rather than one total.
   *
   * **Delete is drawn and disabled rather than hidden**, because the reason is
   * the interesting part: there is no reverse index that could tell you what
   * deleting this would break.
   */
  let { contextId = "cx-drafts" }: { contextId?: string } = $props();

  const it = $derived(context(contextId).current);
  const resolve = $derived(retrievabilityOf(contextId).current);
  const dependents = $derived(usedBy(contextId).current);

  /**
   * The time the rule was worked out is recorded only on the manifest a search
   * carries, so that is where it is read from.
   */
  const workedOut = $derived(searchIn(contextId, "").current[0]?.searched.at);

  let nameDraft = $state("");
  let aboutDraft = $state("");

  /** One line per kind of consumer; the Used by view holds the rows themselves. */
  const groups = $derived(
    [...new Set(dependents.map((dependent: Dependent) => dependent.group))].map(
      (group: Dependent["group"]) => ({
        group,
        count: dependents.filter((dependent: Dependent) => dependent.group === group).length
      })
    )
  );
</script>

<Panel title="Overview">
  {#snippet actions()}
    <PanelButton
      label="Duplicate"
      icon={Copy}
      onclick={() => view.inspect("scope.context", { kind: "context", id: it.id })}
    />
    <PanelButton label="Delete" icon={Trash2} tone="danger" disabled title={it.deleteBlocked} />
  {/snippet}

  <PanelFields>
    <PanelField label="Name" stacked>
      <PanelEditableText
        value={nameDraft || it.name}
        label="Context name"
        onchange={(next: string) => (nameDraft = next)}
      />
    </PanelField>
    <PanelField label="About" stacked>
      <PanelEditableText
        value={aboutDraft || it.description}
        label="What this Context is supposed to cover"
        placeholder="Say what this Context is supposed to cover"
        multiline
        onchange={(next: string) => (aboutDraft = next)}
      />
    </PanelField>
  </PanelFields>

  <PanelSection title="Right now">
    <PanelFields>
      <PanelField label="Contains" mono>{resolve.contains} resources</PanelField>
      <PanelField label="Retrievable" mono>{resolve.indexed} of them</PanelField>
      <PanelField label="Worked out" mono>{workedOut ?? "Not yet"}</PanelField>
    </PanelFields>
    <PanelNote>
      A Context is a rule, not a list. A document created tomorrow that fits the
      rule is in it without anyone editing this.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Saved">
    <PanelChip tone={it.state === "saved" ? "success" : "attention"}>
      {it.state === "saved" ? `Saved · revision ${it.revision}` : `${it.unsaved} unsaved changes`}
    </PanelChip>
  </PanelSection>

  <PanelSection title="Used by" count={dependents.length} open={false} flush>
    {#each groups as entry (entry.group)}
      <PanelRow
        title={entry.group}
        meta={String(entry.count)}
        onselect={() => view.selectContext("scope.used-by")}
      />
    {/each}
    <PanelNote tone="gap">
      Only consumers the backend can query truthfully are counted. There is no
      universal reverse index, so this can never claim to be complete.
    </PanelNote>
  </PanelSection>
</Panel>
