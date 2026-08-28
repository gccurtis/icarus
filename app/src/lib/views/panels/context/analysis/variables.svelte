<script lang="ts">
  import Braces from "@lucide/svelte/icons/braces";
  import Calendar from "@lucide/svelte/icons/calendar";
  import Hash from "@lucide/svelte/icons/hash";
  import SquareFunction from "@lucide/svelte/icons/square-function";
  import Table2 from "@lucide/svelte/icons/table-2";
  import ToggleLeft from "@lucide/svelte/icons/toggle-left";
  import Type from "@lucide/svelte/icons/type";

  import {
    Panel,
    PanelNote,
    PanelRow,
    PanelSearch,
    PanelSection
  } from "$components/authored/panel";
  import { functionsIn, tablesIn, valuesIn } from "$capabilities/analysis";
  import { viewState } from "$model/client/view-state";

  const view = viewState();

  /**
   * What can be charted, with each table's fields expanded underneath it.
   *
   * `docs/screen-panel-views/context/analysis/variables.md` is the
   * specification. The same seven project variables as the name manager, shown
   * differently: here a person is picking a *field* rather than referring to a
   * name, so the fields have to be visible and a type has to sit beside each one.
   *
   * **A field row does not select.** The lens is on the variable that holds the
   * field — there is nothing to inspect about a column on its own — so field
   * rows are not buttons and do not offer a hover fill.
   */
  const projectId = view.project;

  const tables = $derived(tablesIn(projectId).current);
  const values = $derived(valuesIn(projectId).current);
  const functions = $derived(functionsIn(projectId).current);

  let search = $state("");
  const term = $derived(search.trim().toLowerCase());

  /**
   * A table survives on its own name, with every field under it, or on one of
   * its field names, in which case only the matching fields are shown. Searching
   * for `customerMinutes` has to find the column and not merely the table it is
   * in, because the column is what gets dropped.
   */
  const shownTables = $derived(
    tables
      .map((table) =>
        table.name.toLowerCase().includes(term)
          ? table
          : { ...table, fields: table.fields.filter((field) => field.name.toLowerCase().includes(term)) }
      )
      .filter((table) => table.fields.length > 0 || table.name.toLowerCase().includes(term))
  );

  const shownValues = $derived(values.filter((value) => value.name.toLowerCase().includes(term)));
  const shownFunctions = $derived(functions.filter((fn) => fn.name.toLowerCase().includes(term)));

  const total = $derived(tables.length + values.length + functions.length);
  const matched = $derived(shownTables.length + shownValues.length + shownFunctions.length);

  /** A narrowed group says what it is out of; an untouched one is just its size. */
  const counted = (shown: number, all: number): number | string =>
    shown === all ? all : `${shown} of ${all}`;

  /** The type is the thing that decides where a field may go, so it gets the glyph. */
  const ICON = {
    text: Type,
    number: Hash,
    date: Calendar,
    logic: ToggleLeft,
    range: Braces
  };
</script>

<Panel title="Variables">
  <PanelSearch
    placeholder="Search variables and fields"
    {matched}
    {total}
    empty="No variable or field matches."
    bind:value={search}
    flush
  >
    <PanelSection title="Tables" count={counted(shownTables.length, tables.length)} flush>
      {#each shownTables as table (table.id)}
        <PanelRow
          title={table.name}
          meta="{table.rows.toLocaleString('en-GB')} rows"
          icon={Table2}
          selected={view.selection?.id === table.id}
          onselect={() =>
            view.inspect("analysis.variable", { kind: "variable", id: table.id })}
        />

        {#each table.fields as field (field.name)}
          <PanelRow indent title={field.name} meta={field.type} icon={ICON[field.type]} />
        {/each}
      {/each}

      <PanelNote>
        A field's type is inferred by inspecting the column. A column that is mostly numbers with
        three strings in it has no single type, and the row shows one anyway.
      </PanelNote>
    </PanelSection>

    <PanelSection title="Values" count={counted(shownValues.length, values.length)} flush>
      {#each shownValues as value (value.id)}
        <PanelRow
          title={value.name}
          sub={value.value}
          meta={value.type}
          icon={ICON[value.type]}
          selected={view.selection?.id === value.id}
          onselect={() =>
            view.inspect("analysis.variable", { kind: "variable", id: value.id })}
        />
      {/each}

      <PanelNote tone="gap">
        A scalar is a reference line or a value to filter against, never an axis — and what
        dropping one on a zone does is undefined. Until it has a defined result these should not
        be draggable at all.
      </PanelNote>
    </PanelSection>

    <!--
      Shut, because a function is never an answer to "what shall I chart?". It is
      here so that seeing the name later is not a surprise.
    -->
    <PanelSection
      title="Functions"
      count={counted(shownFunctions.length, functions.length)}
      open={false}
      flush
    >
      {#each shownFunctions as fn (fn.id)}
        <PanelRow
          title={fn.signature}
          sub={fn.shape}
          meta="not a chart input"
          icon={SquareFunction}
        />
      {/each}

      <PanelNote>A function is not a value, so it cannot be charted and these rows do not select.</PanelNote>
    </PanelSection>
  </PanelSearch>

  <!-- Panel furniture: true of every zone in Fields, so it is said once, here. -->
  <PanelNote>
    Nothing here is drag-only. Every drop zone also has an Add menu and a keyboard path.
  </PanelNote>
</Panel>
