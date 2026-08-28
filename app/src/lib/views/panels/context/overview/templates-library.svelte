<script lang="ts">
  import Plus from "@lucide/svelte/icons/plus";
  import SquareArrowOutUpRight from "@lucide/svelte/icons/square-arrow-out-up-right";
  import WandSparkles from "@lucide/svelte/icons/wand-sparkles";

  import {
    Panel,
    PanelActions,
    PanelButton,
    PanelField,
    PanelFields,
    PanelNote,
    PanelSection
  } from "$components/authored/panel";
  import {
    template,
    templateKinds,
    templates,
    useTemplateDraft,
    variablesIn,
    type LibraryTemplate,
    type TemplateTarget,
    type TemplateVariable
  } from "$capabilities/library";
  import { viewState } from "$model/client/view-state";

  const view = viewState();

  /**
   * What a template is, what this project has, and what is selected.
   *
   * `docs/screen-panel-views/context/overview/templates-library.md` is the
   * specification.
   *
   * **The counts are by kind rather than a single total**, because the fastest
   * way to notice this project has no deck template is a zero beside *Slide
   * decks*.
   *
   * **Global templates are counted apart from the project's own.** One can be
   * used here; who may edit it is a deployment rule rather than something the
   * absence of a project says.
   */
  let { templateId = "tp-filing" }: { templateId?: string } = $props();

  const all = $derived(templates().current);
  const kinds = $derived(templateKinds().current);
  const it = $derived(template(templateId).current);
  const draft = $derived(useTemplateDraft(templateId).current);
  const variables = $derived(variablesIn(templateId).current);

  const mine = $derived(all.filter((row: LibraryTemplate) => row.scope === "Project"));
  const elsewhere = $derived(all.filter((row: LibraryTemplate) => row.scope !== "Project"));

  /** A single slide is not a deck, so the plural has to say which one it means. */
  const PLURAL: Record<TemplateTarget, string> = {
    Document: "Documents",
    "Slide deck": "Slide decks",
    Slide: "Single slides",
    Spreadsheet: "Spreadsheets"
  };

  const required = $derived(
    variables.filter((variable: TemplateVariable) => variable.required).length
  );

  const asks = $derived(
    variables.length === 0 ? "None" : `${required} of ${variables.length} required`
  );
</script>

<Panel title="Overview">
  {#snippet actions()}
    <!--
      Making a template is an act of the map, not of the title: the library's
      header lists what there is, and what you can add to it belongs beside the
      counts that say how much there already is.

      The kind picker is not built yet, so this lands on a blank Document rather
      than asking what to make first.
    -->
    <PanelButton
      label="New template"
      icon={Plus}
      tone="primary"
      onclick={() => view.showSubscreen("editor", "new")}
    />
  {/snippet}

  <PanelNote>
    A template is an ordinary body with some of it left open. Authoring one is
    authoring a document, a deck, a slide or a spreadsheet — there is no separate
    template editor.
  </PanelNote>

  <PanelSection title="In this project">
    <PanelFields>
      <PanelField label="Templates" mono>{mine.length}</PanelField>
      {#each kinds as kind (kind.id)}
        <PanelField label={PLURAL[kind.makes]} mono>
          {mine.filter((row: LibraryTemplate) => row.makes === kind.makes).length}
        </PanelField>
      {/each}
    </PanelFields>
  </PanelSection>

  <PanelSection title="From outside this project">
    <PanelFields>
      <PanelField label="Templates" mono>{elsewhere.length}</PanelField>
    </PanelFields>
    <PanelNote tone="gap">
      A shared or personal template can be used here. Who may edit one is
      undefined by the model, so this panel does not claim either way.
    </PanelNote>
  </PanelSection>

  <PanelSection title="Selected">
    <PanelFields>
      <PanelField label="Name" stacked>{it.name}</PanelField>
      <PanelField label="Makes">{it.makes}</PanelField>
      <PanelField label="Variables" mono>{asks}</PanelField>
    </PanelFields>

    <PanelActions>
      <PanelButton
        label="Open"
        icon={SquareArrowOutUpRight}
        onclick={() =>
          view.inspect("library.template", { kind: "template", id: it.id })}
      />
      <!-- Disabled, and the reason is the door's own sentence rather than a guess. -->
      <PanelButton
        label="Use"
        icon={WandSparkles}
        tone="primary"
        disabled={!draft.canCreate}
        title={draft.canCreate ? "Make something from this template" : draft.blockedBecause}
        onclick={() =>
          view.inspect("library.use-template", { kind: "template", id: it.id })}
      />
    </PanelActions>
  </PanelSection>
</Panel>
