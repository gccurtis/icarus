<script lang="ts">
  import {
    Panel,
    PanelField,
    PanelFields,
    PanelNote,
    PanelSection,
    PanelSelect,
    PanelToggle
  } from "$components/authored/panel";
  import { deckTheme, layout } from "$capabilities/resource";

  /**
   * What this layout takes from the deck theme, and what it overrides.
   *
   * `docs/screen-panel-views/context/resource/layout-theme.md` is the
   * specification. A layout inherits the deck theme unless it overrides it, so
   * every value here says which of the two it is — an inherited value and a set
   * value that happen to match are not the same fact.
   *
   * The override is held in this panel: no door writes one, and a switch that did
   * not move would hide the distinction this view exists to show.
   */
  let { deckId = "r-board", layoutId = "ly-two-panes" }: { deckId?: string; layoutId?: string } =
    $props();

  const record = $derived(layout(layoutId).current);
  const theme = $derived(deckTheme(deckId).current);

  /** "Inherited from theme" is the absence of an override; anything else is one. */
  const stored = $derived(
    record.backgroundSource === "Inherited from theme" ? undefined : record.backgroundSource
  );
  const storedColour = $derived(stored?.split(" · ")[1]);

  let edited = $state<{ overriding: boolean; colour: string } | undefined>(undefined);

  const overriding = $derived(edited?.overriding ?? storedColour !== undefined);
  const colour = $derived(edited?.colour ?? storedColour ?? theme.backgroundColor);

  /**
   * The theme's own background plus its named colours. A stored override naming
   * something outside that set is kept in the list, so opening this panel cannot
   * silently offer to change a value it could not offer back.
   */
  const options = $derived.by(() => {
    const names = [theme.backgroundColor, ...theme.colors.map((entry) => entry.name)];
    if (storedColour !== undefined && !names.includes(storedColour)) names.push(storedColour);
    return names.map((name) => ({ value: name, label: name }));
  });
</script>

<Panel title="Theme">
  <PanelSection title="Background">
    <PanelFields>
      <!--
        Kind is a fact rather than a control: Solid is the only background the
        model has, and a select with one option is a select that lies about choice.
      -->
      <PanelField label="Kind">{theme.backgroundKind}</PanelField>

      <PanelField label="Override" stacked>
        <PanelToggle
          label="Override the deck theme"
          checked={overriding}
          onchange={(next: boolean) => (edited = { overriding: next, colour })}
        />
      </PanelField>

      <PanelField label="Colour" stacked>
        {#if overriding}
          <PanelSelect
            label="Background colour"
            value={colour}
            {options}
            onchange={(next: string) => (edited = { overriding: true, colour: next })}
          />
        {:else}
          {theme.backgroundColor}
        {/if}
      </PanelField>

      <PanelField label="Source">
        {overriding ? "Set on this layout" : "Inherited from the deck theme"}
      </PanelField>
    </PanelFields>
  </PanelSection>

  <PanelNote>
    With the override off, the value follows the deck theme and changes with it.
  </PanelNote>

  <PanelNote tone="gap">
    Only background is offered. Whether a layout can override type or palette as
    well is undecided, and until it is there is nothing here to mark as inherited.
  </PanelNote>
</Panel>
