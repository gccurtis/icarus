<script lang="ts">
  let {
    number,
    eyebrow,
    title,
    description
  }: {
    number: string;
    eyebrow: string;
    title: string;
    description: string;
  } = $props();
</script>

<header class="section-heading">
  <span class="number">{number}</span>
  <div>
    <small>{eyebrow}</small>
    <h2>{title}</h2>
  </div>
  <p>{description}</p>
</header>

<style>
  .section-heading {
    display: grid;
    grid-template-columns: 3rem minmax(14rem, 0.72fr) minmax(18rem, 1fr);
    gap: 1.25rem;
    align-items: start;
    padding-bottom: 1.5rem;
    border-bottom: 1px solid var(--token-border-strong);
  }

  .number {
    color: var(--token-color-active-text);
    font: 600 0.62rem/1.5 "IBM Plex Mono", monospace;
  }

  small {
    display: block;
    color: var(--token-ink-muted);
    font-size: 0.6rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  h2 {
    max-width: 18ch;
    margin: 0.35rem 0 0;
    font-size: clamp(1.65rem, 3vw, 2.7rem);
    line-height: 1;
    letter-spacing: -0.045em;
  }

  p {
    max-width: 66ch;
    margin: 0;
    color: var(--token-ink-secondary);
    font-size: 0.84rem;
    line-height: 1.65;
  }

  @media (max-width: 54rem) {
    .section-heading {
      grid-template-columns: 2rem 1fr;
    }

    .section-heading p {
      grid-column: 2;
    }
  }

  @media (max-width: 34rem) {
    .section-heading {
      grid-template-columns: 1fr;
    }

    .section-heading p {
      grid-column: auto;
    }
  }
</style>
