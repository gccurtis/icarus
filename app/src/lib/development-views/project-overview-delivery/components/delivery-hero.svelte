<script lang="ts">
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import Check from "@lucide/svelte/icons/check";
  import GitCommitHorizontal from "@lucide/svelte/icons/git-commit-horizontal";

  import {
    DELIVERY_COMMITS,
    DELIVERY_RANGE,
    DELIVERY_TOTALS
  } from "$development-views/project-overview-delivery/procedures/release";
</script>

<header class="hero">
  <div class="hero-topline">
    <a href="/demo/project-overview-panels"><ArrowLeft size={13} aria-hidden="true" /> Panel reference</a>
    <span><Check size={12} aria-hidden="true" /> Merged and verified</span>
  </div>

  <div class="hero-copy">
    <div>
      <span class="eyebrow">Project Overview · delivery reference</span>
      <h1>From panel concept to production boundary.</h1>
    </div>
    <p>
      This page records everything delivered when <code>{DELIVERY_RANGE.before}</code> advanced to
      <code>{DELIVERY_RANGE.after}</code>: the six views, their server contract, the shared
      vocabulary they required, represented data, architecture repairs, and executable evidence.
    </p>
  </div>

  <div class="range" aria-label="Git comparison range">
    <div>
      <small>Before</small>
      <strong>{DELIVERY_RANGE.before}</strong>
      <span>{DELIVERY_RANGE.beforeLabel}</span>
    </div>
    <i aria-hidden="true">→</i>
    <div>
      <small>After</small>
      <strong>{DELIVERY_RANGE.after}</strong>
      <span>{DELIVERY_RANGE.afterLabel}</span>
    </div>
    <code>git diff {DELIVERY_RANGE.expression}</code>
  </div>

  <dl class="metrics" aria-label="Delivery totals">
    <div><dt>Commits</dt><dd>{DELIVERY_TOTALS.commits}</dd></div>
    <div><dt>Files</dt><dd>{DELIVERY_TOTALS.files}</dd></div>
    <div><dt>New</dt><dd>{DELIVERY_TOTALS.newFiles}</dd></div>
    <div><dt>Modified</dt><dd>{DELIVERY_TOTALS.modifiedFiles}</dd></div>
    <div><dt>Additions</dt><dd>+{DELIVERY_TOTALS.additions.toLocaleString("en-US")}</dd></div>
    <div><dt>Deletions</dt><dd>−{DELIVERY_TOTALS.deletions}</dd></div>
  </dl>

  <ol class="commits" aria-label="Delivered commits">
    {#each DELIVERY_COMMITS as commit, index (commit.id)}
      <li>
        <span class="commit-line"><GitCommitHorizontal size={15} aria-hidden="true" /></span>
        <div>
          <small>Commit {String(index + 1).padStart(2, "0")}</small>
          <code>{commit.id}</code>
          <h2>{commit.title}</h2>
          <p>{commit.purpose}</p>
        </div>
      </li>
    {/each}
  </ol>
</header>

<style>
  .hero {
    padding: 2rem clamp(1.25rem, 5vw, 5rem) 0;
    border-bottom: 1px solid var(--token-border-strong);
    background:
      radial-gradient(circle at 82% 5%, color-mix(in srgb, var(--token-color-active-surface) 80%, transparent), transparent 28rem),
      color-mix(in srgb, var(--token-surface-canvas) 97%, transparent);
  }

  .hero-topline,
  .hero-topline a,
  .hero-topline span {
    display: flex;
    align-items: center;
  }

  .hero-topline {
    justify-content: space-between;
    gap: 1rem;
    color: var(--token-ink-muted);
    font-size: 0.65rem;
    font-weight: 650;
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }

  .hero-topline a,
  .hero-topline span {
    gap: 0.35rem;
  }

  .hero-topline a {
    color: var(--token-color-interactive-text);
  }

  .hero-copy {
    display: grid;
    grid-template-columns: minmax(24rem, 1.25fr) minmax(20rem, 0.75fr);
    gap: clamp(2rem, 7vw, 7rem);
    align-items: end;
    padding: clamp(3.5rem, 8vw, 7.5rem) 0 3rem;
  }

  .eyebrow,
  small {
    color: var(--token-ink-muted);
    font-size: 0.6rem;
    font-weight: 700;
    letter-spacing: 0.11em;
    text-transform: uppercase;
  }

  h1 {
    max-width: 13ch;
    margin: 0.8rem 0 0;
    font-size: clamp(3.2rem, 7vw, 7.2rem);
    line-height: 0.88;
    letter-spacing: -0.067em;
  }

  .hero-copy > p {
    max-width: 55ch;
    margin: 0;
    padding-bottom: 0.3rem;
    color: var(--token-ink-secondary);
    font-size: 0.94rem;
    line-height: 1.7;
  }

  code {
    color: var(--token-color-interactive-text);
    font: 600 0.72em/1.5 "IBM Plex Mono", monospace;
  }

  .range {
    display: grid;
    grid-template-columns: 1fr auto 1fr minmax(14rem, 0.8fr);
    align-items: stretch;
    border: 1px solid var(--token-border-strong);
    border-top: 3px solid var(--token-color-active-border);
    background: var(--token-surface-elevated);
    box-shadow: var(--token-shadow-panel);
  }

  .range > div {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 0.25rem 1rem;
    padding: 1.1rem 1.25rem;
  }

  .range strong {
    grid-row: 1 / 3;
    font: 650 1.55rem/1 "IBM Plex Mono", monospace;
  }

  .range span {
    color: var(--token-ink-secondary);
    font-size: 0.66rem;
  }

  .range > i {
    display: grid;
    place-items: center;
    padding-inline: 0.7rem;
    border-inline: 1px solid var(--token-border-subtle);
    color: var(--token-color-active-text);
    font-style: normal;
  }

  .range > code {
    display: flex;
    align-items: center;
    padding: 1rem 1.25rem;
    border-inline-start: 1px solid var(--token-border-subtle);
    background: var(--token-surface-panel);
    overflow-wrap: anywhere;
  }

  .metrics {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    margin: 1rem 0 0;
    border: 1px solid var(--token-border-strong);
    border-bottom: 0;
    background: var(--token-surface-panel);
  }

  .metrics div {
    display: flex;
    min-height: 5rem;
    flex-direction: column-reverse;
    justify-content: space-between;
    padding: 0.85rem 1rem;
    border-inline-end: 1px solid var(--token-border-subtle);
  }

  .metrics div:last-child { border-inline-end: 0; }
  .metrics dt { color: var(--token-ink-muted); font-size: 0.58rem; text-transform: uppercase; }
  .metrics dd { margin: 0; font: 650 1.45rem/1 "IBM Plex Mono", monospace; }

  .commits {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    margin: 0;
    padding: 0;
    border-inline: 1px solid var(--token-border-strong);
    list-style: none;
  }

  .commits li {
    display: grid;
    grid-template-columns: 2.5rem minmax(0, 1fr);
    min-width: 0;
    padding: 1.25rem 1.25rem 1.5rem 0;
    border-top: 1px solid var(--token-border-strong);
    border-inline-end: 1px solid var(--token-border-subtle);
    background: color-mix(in srgb, var(--token-surface-elevated) 80%, transparent);
  }

  .commits li:last-child { border-inline-end: 0; }
  .commit-line { display: flex; justify-content: center; color: var(--token-color-active-text); }
  .commits code { display: block; margin-top: 0.2rem; }
  .commits h2 { margin: 0.7rem 0 0; font-size: 0.87rem; }
  .commits p { margin: 0.55rem 0 0; color: var(--token-ink-secondary); font-size: 0.69rem; line-height: 1.55; }

  @media (max-width: 68rem) {
    .hero-copy { grid-template-columns: 1fr; gap: 1.5rem; }
    .range { grid-template-columns: 1fr auto 1fr; }
    .range > code { grid-column: 1 / -1; border-top: 1px solid var(--token-border-subtle); border-inline-start: 0; }
    .metrics { grid-template-columns: repeat(3, 1fr); }
    .metrics div:nth-child(3) { border-inline-end: 0; }
    .metrics div:nth-child(-n + 3) { border-bottom: 1px solid var(--token-border-subtle); }
  }

  @media (max-width: 48rem) {
    .hero-copy { padding-top: 3.5rem; }
    h1 { font-size: clamp(3rem, 15vw, 5rem); }
    .commits { grid-template-columns: 1fr; }
    .commits li { border-inline-end: 0; }
  }

  @media (max-width: 34rem) {
    .range { grid-template-columns: 1fr; }
    .range > i { min-height: 2rem; border-block: 1px solid var(--token-border-subtle); border-inline: 0; transform: rotate(90deg); }
    .metrics { grid-template-columns: repeat(2, 1fr); }
    .metrics div:nth-child(3) { border-inline-end: 1px solid var(--token-border-subtle); }
    .metrics div:nth-child(2n) { border-inline-end: 0; }
    .metrics div:nth-child(-n + 4) { border-bottom: 1px solid var(--token-border-subtle); }
  }
</style>
