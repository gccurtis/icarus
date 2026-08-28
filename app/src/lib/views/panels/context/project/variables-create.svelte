<script lang="ts">
  import {
    Panel,
    PanelButton,
    PanelCrumbs,
    PanelEditableText,
    PanelField,
    PanelFields,
    PanelNote,
    PanelPair,
    PanelPairs,
    PanelSelect
  } from "$components/authored/panel";
  import { Separator } from "$lib/components/vendor/separator";
  import { variables } from "$capabilities/project";

  /**
   * One variable being defined.
   *
   * `docs/screen-panel-views/context/project/variables-create.md` is the
   * specification. The Variables panel switches to this in place rather than
   * opening a modal: a variable is defined against the formulas and fields you
   * can see, so the work surface stays where it is and the panel becomes the form.
   *
   * The name manager **evaluates nothing**. What is entered here is a value, not
   * an expression, so there is no preview band and nothing to refresh.
   */
  let { onback }: { onback: () => void } = $props();

  const taken = $derived(new Set(variables().current.map((variable) => variable.key)));

  let name = $state("");
  let type = $state("number");
  let value = $state("");
  let pairs = $state<{ key: string; value: string }[]>([]);

  const TYPES = [
    { value: "text", label: "Text" },
    { value: "number", label: "Number" },
    { value: "logic", label: "Logic" },
    { value: "date", label: "Date" },
    { value: "list", label: "List" },
    { value: "record", label: "Record" },
    { value: "table", label: "Table" },
    { value: "range", label: "Range" },
    { value: "function", label: "Function" }
  ] as const;

  const LOGIC = [
    { value: "true", label: "True" },
    { value: "false", label: "False" }
  ] as const;

  /**
   * The check is on the lookup form — lowercased and whitespace-normalized —
   * because `TargetMargin`, `targetmargin` and `Target Margin` are one variable.
   * What is shown back is the casing that was typed.
   */
  const key = $derived(name.trim().toLowerCase().replace(/\s+/g, ""));
  const conflict = $derived(key.length > 0 && taken.has(key));
  const blocked = $derived(key.length === 0 || conflict);

  const pairing = $derived(type === "record" || type === "list" || type === "table");
</script>

<Panel title="Create variable">
  <!--
    A context view does not normally carry a trail — it is not inside anything.
    This one is: the panel has switched to a state that has to be left, and the
    trail is what leaves it.
  -->
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[{ label: "Variables", key: "variables" }, { label: "Create variable" }]}
      onnavigate={onback}
    />
  {/snippet}

  <PanelFields>
    <PanelField label="Name" stacked>
      <PanelEditableText
        label="Name"
        value={name}
        placeholder="hardeningBudget"
        activate="click"
        onchange={(next) => (name = next)}
      />
    </PanelField>

    <PanelField label="Type" stacked>
      <PanelSelect
        label="Type"
        value={type}
        options={TYPES}
        onchange={(next) => {
          type = next;
          value = "";
          pairs = [];
        }}
      />
    </PanelField>

    <PanelField label="Value" stacked>
      {#if type === "logic"}
        <PanelSelect
          label="Value"
          value={value === "" ? "true" : value}
          options={LOGIC}
          onchange={(next) => (value = next)}
        />
      {:else if pairing}
        <!--
          A List's name column is ordinal and cannot be renamed — positions are
          reordered, not renamed. A Record's can.
        -->
        <PanelPairs
          columns={type === "list" ? ["Position", "Value"] : ["Field", "Value"]}
          empty="Nothing in it yet."
          count={pairs.length}
          addLabel={type === "list" ? "Add an item" : "Add a field"}
          onadd={() =>
            (pairs = [...pairs, { key: type === "list" ? String(pairs.length + 1) : "", value: "" }])}
        >
          {#each pairs as pair, index (index)}
            <PanelPair
              name={pair.key}
              value={pair.value}
              mono
              onrename={type === "list"
                ? undefined
                : (next) =>
                    (pairs = pairs.map((row, at) => (at === index ? { ...row, key: next } : row)))}
              onchange={(next) =>
                (pairs = pairs.map((row, at) => (at === index ? { ...row, value: next } : row)))}
              onremove={() => (pairs = pairs.filter((_, at) => at !== index))}
            />
          {/each}
        </PanelPairs>
      {:else}
        <PanelEditableText
          label="Value"
          value={value}
          multiline={type === "text" || type === "function"}
          mono={type !== "text"}
          placeholder={type === "range" ? "Outages!A1:D400" : ""}
          onchange={(next) => (value = next)}
        />
      {/if}
    </PanelField>
  </PanelFields>

  <Separator />

  <!--
    The commit at the end of the form it commits. `Panel` has no pinned footer and
    should not gain one — its objection is to a control buried under content of
    unbounded length, and three fields are bounded. There is no Cancel: the
    breadcrumb is the way out, and a Cancel beside the commit would read as the
    more deliberate of two exits that are the same exit.
  -->
  <div class="px-3">
    <PanelButton
      label="Define variable"
      tone="primary"
      disabled={blocked}
      title={conflict ? "That name is already taken" : undefined}
      onclick={onback}
    />
  </div>

  {#if conflict}
    <PanelNote tone="gap">
      <strong>{name.trim()}</strong> is already defined. A name conflict is decided before the value
      is looked at, so nothing else here is wrong yet.
    </PanelNote>
  {/if}

  <PanelNote>
    Leaving discards what has been entered. There is nowhere to park a half-defined
    variable, and one that reappeared against a project that has moved on is worse
    than one that did not.
  </PanelNote>
</Panel>
