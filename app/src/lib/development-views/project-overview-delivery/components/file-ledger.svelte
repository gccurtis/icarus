<script lang="ts">
  import ChevronDown from "@lucide/svelte/icons/chevron-down";
  import FileDiff from "@lucide/svelte/icons/file-diff";

  import SectionHeading from "$development-views/project-overview-delivery/components/section-heading.svelte";
  import {
    DELTA_GROUPS,
    deltaAdditionCount,
    deltaDeletionCount,
    deltaFileCount
  } from "$development-views/project-overview-delivery/procedures/ledger";
</script>

<section id="ledger" class="section">
  <SectionHeading
    number="06"
    eyebrow="Exact delta"
    title="Every changed file, accounted for"
    description="This is the complete 3e670c5..930fb95 ledger, grouped by responsibility rather than filesystem accident. Group totals sum to the Git range; every path appears once. Expand a group to inspect its exact files."
  />

  <div class="ledger-total">
    <span class="ledger-icon"><FileDiff size={18} aria-hidden="true" /></span>
    <span><strong>{deltaFileCount()}</strong> files</span>
    <span><strong>+{deltaAdditionCount().toLocaleString("en-US")}</strong> additions</span>
    <span><strong>−{deltaDeletionCount()}</strong> deletions</span>
  </div>

  <div class="groups">
    {#each DELTA_GROUPS as group, index (group.id)}
      <details open={index === 0}>
        <summary>
          <span class="index">{String(index + 1).padStart(2, "0")}</span>
          <span class="group-copy"><strong>{group.label}</strong><small>{group.summary}</small></span>
          <code>{group.files.length} files · +{group.additions.toLocaleString("en-US")} / −{group.deletions}</code>
          <span class="chevron"><ChevronDown size={15} aria-hidden="true" /></span>
        </summary>
        <ol>
          {#each group.files as file (file.path)}
            <li data-delta-file={file.path}>
              <span class:new={file.status === "New"}>{file.status === "New" ? "A" : "M"}</span>
              <code>{file.path}</code>
            </li>
          {/each}
        </ol>
      </details>
    {/each}
  </div>
</section>

<style>
  .section { padding: 4.5rem clamp(1.25rem, 5vw, 5rem) 6rem; border-top: 1px solid var(--token-border-strong); background: var(--token-surface-work); }
  .ledger-total { display: flex; gap: 1.2rem; align-items: center; margin-top: 2rem; padding: 0.9rem 1rem; border: 1px solid var(--token-border-strong); border-top: 3px solid var(--token-color-active-border); background: var(--token-surface-inverted); color: var(--token-ink-on-inverted); }
  .ledger-total > span { color: color-mix(in srgb, currentColor 68%, transparent); font-size: 0.62rem; }
  .ledger-total strong { margin-inline-end: 0.22rem; color: currentColor; font: 650 0.75rem/1 "IBM Plex Mono", monospace; }
  .groups { border-inline: 1px solid var(--token-border-strong); }
  details { border-bottom: 1px solid var(--token-border-strong); background: var(--token-surface-elevated); }
  summary { display: grid; grid-template-columns: 2rem minmax(0, 1fr) auto 1rem; gap: 0.75rem; align-items: center; padding: 1rem; cursor: pointer; list-style: none; }
  summary::-webkit-details-marker { display: none; }
  .index { color: var(--token-color-active-text); font: 600 0.55rem/1.4 "IBM Plex Mono", monospace; }
  .group-copy { display: flex; min-width: 0; flex-direction: column; gap: 0.22rem; }
  .group-copy strong { font-size: 0.76rem; }
  .group-copy small { max-width: 90ch; color: var(--token-ink-muted); font-size: 0.61rem; line-height: 1.45; }
  summary > code { color: var(--token-ink-muted); font: 500 0.57rem/1.5 "IBM Plex Mono", monospace; white-space: nowrap; }
  .chevron { display: flex; color: var(--token-ink-muted); transition: transform var(--token-duration-micro) var(--token-ease-standard); }
  details[open] .chevron { transform: rotate(180deg); }
  ol { margin: 0; padding: 0; border-top: 1px solid var(--token-border-subtle); background: var(--token-surface-panel); list-style: none; }
  li { display: grid; grid-template-columns: 2rem minmax(0, 1fr); gap: 0.75rem; padding: 0.55rem 1rem; border-bottom: 1px solid var(--token-border-subtle); }
  li:last-child { border-bottom: 0; }
  li > span { align-self: start; width: 1.25rem; padding: 0.1rem; border: 1px solid var(--token-border-strong); color: var(--token-ink-muted); font: 650 0.5rem/1.2 "IBM Plex Mono", monospace; text-align: center; }
  li > span.new { border-color: var(--token-color-success-border); color: var(--token-color-success-text); }
  li code { min-width: 0; color: var(--token-ink-secondary); font: 500 0.59rem/1.5 "IBM Plex Mono", monospace; overflow-wrap: anywhere; }
  @media (max-width: 44rem) {
    .ledger-total { flex-wrap: wrap; }
    .ledger-icon { width: 100%; }
    summary { grid-template-columns: 1.5rem minmax(0, 1fr) 1rem; }
    summary > code { grid-column: 2; white-space: normal; }
    .chevron { grid-column: 3; grid-row: 1; }
  }
</style>
