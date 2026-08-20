<script lang="ts">
  import type { Tab } from "$model/client";
  import { clientModel } from "$model/client";
  import {
    Panel,
    PanelButton,
    PanelNote,
    PanelRow,
    PanelSection
  } from "$lib/unique-components/panel";
  import CircleCheck from "@lucide/svelte/icons/circle-check";
  import Link2 from "@lucide/svelte/icons/link-2";
  import TriangleAlert from "@lucide/svelte/icons/triangle-alert";
  import Zap from "@lucide/svelte/icons/zap";

  /**
   * Only the things that genuinely cannot proceed.
   *
   * The machine's problems, kept out of Mentions so a person addressing you and
   * a token expiring never compete for the same attention.
   *
   * **Nothing derived appears here.** A prompt block and a formula both read
   * their value when they run, so neither can fall behind and neither is ever
   * listed as a problem.
   */
  let { tab }: { tab: Tab } = $props();

  // svelte-ignore state_referenced_locally
  void tab;

  const { workbench } = clientModel();
</script>

<Panel title="Health">
  {#snippet actions()}
    <PanelButton label="Open Automations" icon={Zap} />
  {/snippet}

  <PanelSection title="Connectors" count={2} flush>
    <PanelRow
      title="SharePoint — Ops Reports"
      sub="Authentication expired 6d ago"
      icon={Link2}
      tone="danger"
      onselect={() => workbench.inspect("project.connector")}
    />
    <PanelRow
      title="Google Drive — Filings"
      sub="Synced 2h ago · 148 files"
      icon={CircleCheck}
      tone="success"
      onselect={() => workbench.inspect("project.connector")}
    />
  </PanelSection>

  <PanelSection title="Extraction" count={1} flush>
    <PanelRow
      title="NERC-2025-winter-review.pdf"
      sub="Scanned PDF, no text layer"
      icon={TriangleAlert}
      tone="attention"
      onselect={() => workbench.inspect("project.file")}
    />
  </PanelSection>

  <PanelSection title="Automations" count={1} flush>
    <PanelRow
      title="Nightly filing digest"
      sub="Last dispatch failed"
      icon={Zap}
      tone="danger"
      onselect={() => workbench.inspect("copilot.task")}
    />
  </PanelSection>

  <PanelNote>
    Only things that genuinely cannot proceed. A prompt block or a formula is
    never listed here — both read their value when they run, so neither can fall
    behind.
  </PanelNote>
</Panel>
