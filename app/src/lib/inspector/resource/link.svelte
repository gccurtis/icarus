<script lang="ts">
  import Copy from "@lucide/svelte/icons/copy";
  import ExternalLink from "@lucide/svelte/icons/external-link";
  import Unlink from "@lucide/svelte/icons/unlink";

  import { Separator } from "$lib/simple-components/separator";
  import {
    Panel,
    PanelActions,
    PanelButton,
    PanelCrumbs,
    PanelField,
    PanelFields,
    PanelNote
  } from "$lib/unique-components/panel";
  import { documentRecord, link } from "$mock-capabilities/resource";
  import { mockWorkbench } from "$mock-models/workbench.svelte";

  /**
   * A link mark on a selection: where it goes, and the three things you do
   * with it.
   *
   * `docs/screen-panel-views/inspector/resource/link.md` is the specification.
   * The target and the text are shown together so a link whose text misleads is
   * visible as such.
   *
   * **Open and Copy are in the actions row; Remove is last and separated.** What
   * a panel offers belongs above what it lists, and a destructive action set
   * beside two harmless ones is a misclick waiting to happen. Removing the mark
   * leaves the text selected, so the lens hands the inspector back to the
   * selection the mark was on.
   */
  let { documentId = "r-memo", linkId = "lk-1" }: { documentId?: string; linkId?: string } =
    $props();

  const doc = $derived(documentRecord(documentId).current);
  const mark = $derived(link(linkId).current);

  let copied = $state(false);

  /** An internal target is a resource in this project; an external one is a website. */
  const open = () => {
    if (mark.internal) {
      mockWorkbench.inspect("project.resource", { kind: "resource", id: mark.url });
    } else {
      window.open(mark.url, "_blank", "noopener,noreferrer");
    }
  };

  const copy = () => {
    void navigator.clipboard?.writeText(mark.url);
    copied = true;
  };
</script>

<Panel title="Link">
  {#snippet crumbs()}
    <PanelCrumbs
      trail={[
        { label: doc.title, key: "resource.document" },
        { label: "Text selection", key: "resource.text-selection" },
        { label: "Link" }
      ]}
      onnavigate={(key) => mockWorkbench.inspect(key, { kind: "resource", id: documentId })}
    />
  {/snippet}

  {#snippet actions()}
    <PanelButton label="Open" icon={ExternalLink} onclick={open} />
    <PanelButton label={copied ? "Copied" : "Copy"} icon={Copy} onclick={copy} />
  {/snippet}

  <PanelFields>
    <PanelField label="URL" stacked mono>{mark.url}</PanelField>
    <PanelField label="Text">{mark.text}</PanelField>
    <PanelField label="Target">{mark.internal ? "In this project" : "External"}</PanelField>
  </PanelFields>

  <PanelNote tone="gap">
    An internal link, to another resource in the project, is a different thing
    from a URL. Whether both are the same mark is undecided.
  </PanelNote>

  <Separator />

  <PanelActions>
    <PanelButton
      label="Remove"
      icon={Unlink}
      tone="danger"
      title="Take the link off, and keep the text"
      onclick={() =>
        mockWorkbench.inspect("resource.text-selection", { kind: "resource", id: documentId })}
    />
  </PanelActions>
</Panel>
