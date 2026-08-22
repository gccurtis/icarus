<script lang="ts">
  import Plus from "@lucide/svelte/icons/plus";

  import { Panel, PanelButton, PanelRow, PanelSearch } from "$lib/unique-components/panel";
  import { documentStyles, type NamedTextStyle } from "$mock-capabilities/resource";
  import { viewState } from "$model/client/view-state";

  /**
   * The named styles this document uses.
   *
   * `docs/screen-panel-views/context/resource/styles-document.md` is the
   * specification. Family, size, indentation and line spacing live on a named
   * style and never as a selection-local override, so this is the whole set of
   * answers the document has about how its text looks.
   *
   * **Making one and editing one are different places.** A style is created here
   * and then opened in the named style lens, which is where every property of it
   * lives; a second editor in this panel would be the same form twice, and the
   * one in the lens is the one with room for it.
   */
  let { documentId = "r-memo" }: { documentId?: string } = $props();

  const view = viewState();

  const styles = $derived(documentStyles(documentId).current);

  let search = $state("");

  const shown = $derived(
    styles.filter((style) => style.name.toLowerCase().includes(search.trim().toLowerCase()))
  );

  const open = (styleId: string) =>
    view.inspect("resource.named-style-document", { kind: "style", id: styleId });

  const isOpen = (style: NamedTextStyle) =>
    view.selection?.kind === "style" && view.selection.id === style.id;
</script>

<Panel title="Styles">
  {#snippet actions()}
    <!-- Create, then open the lens: a new style is unnamed and unset until someone sets it. -->
    <PanelButton
      label="New style"
      icon={Plus}
      tone="primary"
      onclick={() => open(`${documentId}:new-style`)}
    />
  {/snippet}

  <!--
    The field contains what it filters, so the scope of the search is answered by
    the markup rather than by a convention held in this file.
  -->
  <PanelSearch
    placeholder="Search styles"
    matched={shown.length}
    total={styles.length}
    bind:value={search}
    flush
  >
    {#each shown as style (style.id)}
      <!--
        Name and typography in shorthand, which is enough to tell two apart. The
        rest of the properties are the lens's business.
      -->
      <PanelRow
        title={style.name}
        sub={style.shorthand}
        selected={isOpen(style)}
        onselect={() => open(style.id)}
      />
    {/each}
  </PanelSearch>
</Panel>
