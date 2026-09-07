<script lang="ts">
</script>

<div class="rows">
  <section class="group template">
    <h4>What the template is</h4>
    <ul>
      <li><code>templates</code><span>projectId, name, tags, body, variables, revision, lastUsedAt</span></li>
      <li><code>templateVersions</code><span>one row per revision, never read back yet</span></li>
    </ul>
    <p class="writer">Written by <code>createTemplate</code>, <code>createTemplateFromResource</code>, <code>updateTemplate</code>, <code>commitTemplateStage</code>, <code>duplicateTemplate</code>, <code>removeTemplate</code></p>
  </section>

  <section class="group stage">
    <h4>What makes a resource a working copy</h4>
    <ul>
      <li><code>templateStages</code><span>projectId, templateId, templateRevision, target, resourceId</span></li>
    </ul>
    <p class="writer">Written by <code>openTemplateStage</code>, moved by <code>updateTemplate</code> and <code>commitTemplateStage</code>, removed by <code>discardTemplateStage</code> and by deleting the template</p>
  </section>

  <section class="group resource">
    <h4>What the editor actually opens</h4>
    <ul>
      <li><code>documents · slideDecks</code><span>an ordinary row, titled Template · name</span></li>
      <li><code>documentSnapshots · slideDeckSnapshots</code><span>the leader body the editor edits</span></li>
      <li><code>documentChangeSets · slideDeckChangeSets</code><span>the ledger, as for any resource</span></li>
    </ul>
    <p class="writer">Written by the document and deck capabilities, which know nothing about templates</p>
  </section>
</div>

<p class="left-out">
  Project Overview, New Tab's recents and the comment picker all read
  <code>readProjectResourceIndex</code>, which skips any resource a stage row occupies — so a working
  copy is invisible everywhere except the tab it is open in.
</p>

<style>
  .rows { display: grid; grid-template-columns: repeat(auto-fit, minmax(17rem, 1fr)); gap: 1rem; }

  .group {
    padding: 1.1rem 1.2rem;
    border: 1px solid var(--token-border-subtle);
    border-radius: 10px;
    background: var(--token-surface-elevated);
  }

  .group.template { border-color: var(--token-color-active-text); background: var(--token-color-active-surface); }
  .group.stage { border-color: var(--token-color-accent-1-text); background: var(--token-color-accent-1-surface); }

  h4 { margin: 0 0 .7rem; font-size: 12px; letter-spacing: .02em; }

  ul { display: grid; gap: .5rem; margin: 0; padding: 0; list-style: none; }

  li { display: grid; gap: .15rem; }

  li code {
    justify-self: start;
    padding: .1rem .35rem;
    border-radius: 4px;
    background: var(--token-surface-canvas);
    font-family: "IBM Plex Mono", ui-monospace, monospace;
    font-size: 11.5px;
    font-weight: 650;
  }

  li span { color: var(--token-ink-secondary); font-size: 11.5px; }

  .writer { margin: .9rem 0 0; padding-top: .7rem; border-top: 1px solid var(--token-border-subtle); color: var(--token-ink-muted); font-size: 11px; }
  .writer code { font-family: "IBM Plex Mono", ui-monospace, monospace; font-size: 10.5px; }

  .left-out { max-width: 70ch; margin: 1rem 0 0; color: var(--token-ink-secondary); font-size: 13px; }
  .left-out code { font-family: "IBM Plex Mono", ui-monospace, monospace; font-size: 11.5px; }
</style>
