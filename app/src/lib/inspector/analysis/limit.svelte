<script lang="ts">
  import Trash2 from "@lucide/svelte/icons/trash-2";

  import {
    Panel,
    PanelActions,
    PanelButton,
    PanelCrumbs,
    PanelEditableText,
    PanelField,
    PanelFields,
    PanelNote,
    PanelSection
  } from "$lib/unique-components/panel";
  import { analysis, limitIn, sortIn } from "$mock-capabilities/analysis";
  import { mockWorkbench } from "$mock-models/workbench.svelte";

  /**
   * How much of the result is shown.
   *
   * `docs/screen-panel-views/inspector/analysis/limit.md` is the specification.
   *
   * **Both numbers, always.** How many are kept without how many there are says
   * nothing: a bar chart of the top ten looks exactly like a bar chart of
   * everything.
   *
   * **The Note band says what "top" means rather than leaving it to the reader.**
   * A limit is meaningless without an order, so the panel names the sort it falls
   * back to — and says so plainly when there is none.
   */
  let { analysisId = "r-minutes" }: { analysisId?: string } = $props();

  const record = $derived(analysis(analysisId).current);
  const rule = $derived(limitIn(analysisId).current);
  const sort = $derived(sortIn(analysisId).current);

  /** The edit, until there is a definition to write it to. */
  let rekept = $state<string | undefined>(undefined);

  const keep = $derived(rekept ?? (rule === null ? "" : String(rule.keep)));
  const groups = $derived(rule === null ? "" : rule.of.toLocaleString("en-GB"));

  const order = $derived(
    sort === null
      ? "There is no sort, so which rows survive the limit is arbitrary."
      : `Top means ${sort.reads}, ${sort.direction.toLowerCase()}.`
  );

  /** Removing the rule leaves nothing to inspect, so the panel falls back to the analysis. */
  const remove = () =>
    mockWorkbench.inspect("analysis.analysis", { kind: "analysis", id: analysisId });
</script>

<Panel title="Limit">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: record.title, key: "analysis.analysis" }, { label: "Limit" }]}
      onnavigate={(key: string) => mockWorkbench.inspect(key)}
    />
  {/snippet}

  {#if rule === null}
    <PanelNote>Nothing limits this result. Every group it produces is drawn.</PanelNote>
  {:else}
    <!--
      "top" is prose around the control rather than part of it: the number is
      what is edited, and the word is what the number means.
    -->
    <PanelFields>
      <PanelField label="Keep">
        top
        <PanelEditableText
          label="How many to keep"
          value={keep}
          mono
          placeholder="All"
          onchange={(next: string) => (rekept = next)}
        />
      </PanelField>
      <PanelField label="Of" mono>{groups} groups</PanelField>
    </PanelFields>

    <PanelSection title="Note">
      <PanelNote>
        The limit is shown next to the chart as well as here, so a truncated view is never
        mistaken for the whole.
      </PanelNote>
      <PanelNote>{order}</PanelNote>
    </PanelSection>

    <!-- Destructive, and last. -->
    <PanelSection title="Actions">
      <PanelActions>
        <PanelButton label="Remove" icon={Trash2} tone="danger" onclick={remove} />
      </PanelActions>
      <PanelNote tone="gap">
        Whether a limit should require a sort, rather than name the order it falls back to, is
        undecided.
      </PanelNote>
    </PanelSection>
  {/if}
</Panel>
