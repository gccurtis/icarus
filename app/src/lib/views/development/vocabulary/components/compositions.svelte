<script lang="ts">
  import CircleCheck from "@lucide/svelte/icons/circle-check";
  import Link2 from "@lucide/svelte/icons/link-2";
  import TriangleAlert from "@lucide/svelte/icons/triangle-alert";
  import Zap from "@lucide/svelte/icons/zap";

  import CommentBox from "$views/development/vocabulary/components/comment-box.svelte";
  import SectionTitle from "$views/development/vocabulary/components/section-title.svelte";
  import Stage from "$views/development/vocabulary/components/stage.svelte";
  import {
    Panel,
    PanelActions,
    PanelButton,
    PanelChip,
    PanelCrumbs,
    PanelField,
    PanelFields,
    PanelNote,
    PanelRow,
    PanelSection
  } from "$components/authored/panel";

  /**
   * The vocabulary in a sentence rather than as words.
   *
   * Two real panels, copied from the built screen: a context view and an
   * inspector lens, side by side at their true width. The point is the ratio —
   * both are about seventy lines of markup, and neither contains a single
   * measurement, colour or radius of its own.
   */
  const HEALTH = `<Panel title="Health">
  {#snippet actions()}
    <PanelButton label="Open Automations" icon={Zap} />
  {/snippet}

  <PanelSection title="Connectors" count={2} flush>
    <PanelRow title="SharePoint — Ops Reports"
      sub="Authentication expired 6d ago"
      icon={Link2} tone="danger"
      onselect={() => workbench.inspect("project.connector")} />
    …
  </PanelSection>

  <PanelSection title="Extraction" count={1} flush>…</PanelSection>
  <PanelSection title="Automations" count={1} flush>…</PanelSection>

  <PanelNote>
    Only things that genuinely cannot proceed. A prompt block
    or a formula is never listed here — both read their value
    when they run, so neither can fall behind.
  </PanelNote>
</Panel>`;

  const CONNECTOR = `<Panel title="SharePoint — Ops Reports">
  {#snippet crumbs()}
    <PanelCrumbs trail={[
      { label: "Project", key: "project.self" },
      { label: "SharePoint — Ops Reports" }
    ]} onnavigate={(key) => workbench.inspect(key)} />
  {/snippet}

  <PanelSection title="Connection">
    <PanelFields>
      <PanelField label="Provider">SharePoint</PanelField>
      <PanelField label="Status">
        <PanelChip tone="danger">Authentication expired</PanelChip>
      </PanelField>
    </PanelFields>
  </PanelSection>

  <PanelSection title="Actions">
    <PanelActions>
      <PanelButton label="Reconnect" tone="primary" />
      <PanelButton label="Sync now" disabled
        title="Authentication has to be repaired first" />
    </PanelActions>
  </PanelSection>
</Panel>`;
</script>

<section class="flex flex-col gap-4">
  <SectionTitle title="Two panels, whole" source="views/context-panel · views/inspector">
    The vocabulary in a sentence rather than as words. Both of these are copied
    from the built Project Overview, at the width they run at. Neither contains a
    measurement, a colour or a radius of its own — that is the whole claim.
  </SectionTitle>

  <div class="flex flex-wrap items-start gap-6">
    <div class="flex flex-col gap-2">
      <span class="text-caption text-ink-muted font-semibold tracking-wide uppercase">
        A context view
      </span>
      <Stage>
        <div class="h-100">
          <Panel title="Health">
            {#snippet actions()}
              <PanelButton label="Open Automations" icon={Zap} />
            {/snippet}
            <PanelSection title="Connectors" count={2} flush>
              <PanelRow title="SharePoint — Ops Reports" sub="Authentication expired 6d ago" icon={Link2} tone="danger" onselect={() => {}} />
              <PanelRow title="Google Drive — Filings" sub="Synced 2h ago · 148 files" icon={CircleCheck} tone="success" onselect={() => {}} />
            </PanelSection>
            <PanelSection title="Extraction" count={1} flush>
              <PanelRow title="NERC-2025-winter-review.pdf" sub="Scanned PDF, no text layer" icon={TriangleAlert} tone="attention" onselect={() => {}} />
            </PanelSection>
            <PanelSection title="Automations" count={1} flush>
              <PanelRow title="Nightly filing digest" sub="Last dispatch failed" icon={Zap} tone="danger" onselect={() => {}} />
            </PanelSection>
            <PanelNote>
              Only things that genuinely cannot proceed. A prompt block or a
              formula is never listed here — both read their value when they run.
            </PanelNote>
          </Panel>
        </div>
      </Stage>
      <pre
        class="text-mono border-border-subtle bg-surface-canvas rounded-control text-ink-secondary m-0 w-75 overflow-x-auto border p-3 font-mono">{HEALTH}</pre>
      <div class="w-75">
        <CommentBox scope="composition" label="A context view" />
      </div>
    </div>

    <div class="flex flex-col gap-2">
      <span class="text-caption text-ink-muted font-semibold tracking-wide uppercase">
        An inspector lens
      </span>
      <Stage>
        <div class="h-100">
          <Panel title="SharePoint — Ops Reports">
            {#snippet crumbs()}
              <PanelCrumbs
                trail={[{ label: "Project", key: "project.self" }, { label: "SharePoint — Ops Reports" }]}
                onnavigate={() => {}}
              />
            {/snippet}
            <PanelSection title="Connection">
              <PanelFields>
                <PanelField label="Provider">SharePoint</PanelField>
                <PanelField label="Display name">Ops Reports</PanelField>
                <PanelField label="Status">
                  <PanelChip tone="danger">Authentication expired</PanelChip>
                </PanelField>
              </PanelFields>
            </PanelSection>
            <PanelSection title="Synchronization">
              <PanelFields>
                <PanelField label="Last sync" mono>6 days ago</PanelField>
                <PanelField label="Error">Refresh token expired</PanelField>
                <PanelField label="Files" mono>312</PanelField>
              </PanelFields>
              <PanelNote tone="gap">
                One last-sync record is all there is. No sync history is modeled,
                so this must not imply a trend.
              </PanelNote>
            </PanelSection>
            <PanelSection title="Actions">
              <PanelActions>
                <PanelButton label="Reconnect" tone="primary" />
                <PanelButton label="Sync now" disabled title="Authentication has to be repaired first" />
                <PanelButton label="Disconnect" tone="danger" />
              </PanelActions>
            </PanelSection>
          </Panel>
        </div>
      </Stage>
      <pre
        class="text-mono border-border-subtle bg-surface-canvas rounded-control text-ink-secondary m-0 w-75 overflow-x-auto border p-3 font-mono">{CONNECTOR}</pre>
      <div class="w-75">
        <CommentBox scope="composition" label="An inspector lens" />
      </div>
    </div>
  </div>
</section>
