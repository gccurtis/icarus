<script lang="ts">
  import Boxes from "@lucide/svelte/icons/boxes";
  import Check from "@lucide/svelte/icons/check";
  import FileText from "@lucide/svelte/icons/file-text";
  import Layers from "@lucide/svelte/icons/layers";
  import Plug from "@lucide/svelte/icons/plug";
  import Shapes from "@lucide/svelte/icons/shapes";

  import {
    Panel,
    PanelNote,
    PanelRow,
    PanelSearch,
    PanelSection
  } from "$lib/unique-components/panel";
  import {
    namedCandidates,
    ruleKinds,
    type NamedCandidate,
    type RuleOption,
    type Side,
    type TermRule
  } from "$mock-capabilities/scope";

  /**
   * Putting something into one half of a Context.
   *
   * `docs/screen-panel-views/context/scope/add.md` is the specification.
   *
   * **A rule and a name are two sections, not one list with a toggle.** A rule
   * keeps matching and a name does not, which is the whole model of a Context —
   * a control flipping between them would make the distinction a setting.
   *
   * **The half is a prop, because it is the half you were pointing at.** Both
   * halves accept the same things, so nothing here differs between them except
   * where the term lands, and that is decided before this panel opens.
   *
   * **The search covers everything below it.** `PanelSearch` contains what it
   * filters, so a field narrowing only the named half while sitting above both
   * would be a scope no reader could check from the markup.
   */
  let { side = "include" }: { side?: Side } = $props();

  let search = $state("");
  /** What has been added in this sitting. Every door here is a read. */
  let added = $state<string[]>([]);

  const half = $derived(side === "include" ? "Include" : "Take out");
  const needle = $derived(search.trim().toLowerCase());

  const rules = $derived(ruleKinds().current);
  const allNamed = $derived(namedCandidates("").current);
  const named = $derived(namedCandidates(search).current);

  const shownRules = $derived(
    rules.filter((option: RuleOption) => option.title.toLowerCase().includes(needle))
  );

  /** One picture per rule kind, so a live rule is tellable from a named thing. */
  const RULE_ICON: Record<TermRule, typeof Layers> = {
    everything: Boxes,
    kind: Shapes,
    context: Layers,
    named: FileText,
    connector: Plug
  };

  const add = (id: string) => {
    if (!added.includes(id)) added = [...added, id];
  };
</script>

<Panel title="Add to this Context">
  <!-- The premise rather than a footnote: nothing below says where a term lands. -->
  <PanelNote>
    Everything chosen here goes on {half}. Both halves accept the same things.
  </PanelNote>

  <PanelSearch
    placeholder="Search rules and resources"
    matched={shownRules.length + named.length}
    total={rules.length + allNamed.length}
    bind:value={search}
    flush
  >
    <PanelSection title="By rule" count={shownRules.length} flush>
      {#each shownRules as option (option.id)}
        {@const on = added.includes(option.id)}
        <PanelRow
          title={option.title}
          sub={on ? `On ${half}` : option.detail}
          meta={option.live ? "Live" : undefined}
          icon={on ? Check : RULE_ICON[option.rule]}
          tone={on ? "success" : "default"}
          onselect={() => add(option.id)}
        />
      {/each}

      <PanelNote>
        A rule keeps matching. What it covers today is not what it will cover
        tomorrow, which is what Live says.
      </PanelNote>
      <PanelNote tone="gap">
        Another saved Context re-reads, and what it re-reads is itself a rule.
        Nothing yet bounds how deep that nests, or catches a Context that ends up
        including itself.
      </PanelNote>
    </PanelSection>

    <PanelSection title="By name" count={named.length} flush>
      {#each named as candidate (candidate.id)}
        {@const on = added.includes(candidate.id)}
        {@const mark = candidate.kind === "connector" ? Plug : FileText}
        <PanelRow
          title={candidate.name}
          sub={on ? `On ${half}` : candidate.detail}
          meta={candidate.expandsTo === undefined ? undefined : `${candidate.expandsTo} files`}
          icon={on ? Check : mark}
          tone={on ? "success" : "default"}
          onselect={() => add(candidate.id)}
        />
      {/each}

      <PanelNote>
        A connector stands for the files it synced rather than for itself, so a
        term naming one brings in everything under it.
      </PanelNote>
      <PanelNote tone="gap">
        A named resource that is later deleted has no resolver contract yet —
        fail, omit it, or come back as an unresolved descriptor are all still
        open.
      </PanelNote>
    </PanelSection>
  </PanelSearch>
</Panel>
