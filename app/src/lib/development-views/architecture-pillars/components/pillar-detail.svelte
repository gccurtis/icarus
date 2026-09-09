<script lang="ts">
  import ArrowLeft from "@lucide/svelte/icons/arrow-left";
  import ArrowRight from "@lucide/svelte/icons/arrow-right";
  import Check from "@lucide/svelte/icons/circle-check-big";
  import Equal from "@lucide/svelte/icons/equal";
  import ShieldCheck from "@lucide/svelte/icons/shield-check";
  import TriangleAlert from "@lucide/svelte/icons/triangle-alert";

  import CheckerCard from "$development-views/architecture-pillars/components/checker-card.svelte";
  import {
    nextPillar,
    pillarBySlug
  } from "$development-views/architecture-pillars/procedures/pillars";
  import "$development-views/architecture-pillars/components/architecture-pillars.css";

  let { slug }: { slug: string } = $props();

  const pillar = $derived(pillarBySlug(slug));
  const next = $derived(nextPillar(slug));
  const enforced = $derived(
    pillar.checkers.filter((checker) => checker.status === "Enforced").length
  );
  const partial = $derived(
    pillar.checkers.filter((checker) => checker.status === "Partial").length
  );
  const missing = $derived(
    pillar.checkers.filter((checker) => checker.status === "Missing").length
  );
</script>

<svelte:head>
  <title>{pillar.name} · Architecture pillars · Icarus</title>
</svelte:head>

<main class="pillars-page pillar-detail-page">
  <a class="back-link" href="/demo/architecture-pillars"><ArrowLeft size={14} aria-hidden="true" /> All architecture pillars</a>

  <header class="pillars-hero detail-hero">
    <div class="pillars-kicker"><ShieldCheck size={15} aria-hidden="true" /> {pillar.code} · Architecture pillar</div>
    <h1>{pillar.name}</h1>
    <p class="pillars-lede">{pillar.thesis}</p>
    <div class="pillars-meta">
      <span>{pillar.checkers.length} specified checkers</span>
      <span>{enforced} enforced · {partial} partial · {missing} missing</span>
      <span>Related audit findings: {pillar.relatedFindings.join(", ")}</span>
    </div>
  </header>

  <section class="pillar-section">
    <div class="pillar-section-heading">
      <div><span>01</span><h2>What this pillar protects</h2></div>
      <p>{pillar.supports}</p>
    </div>
    <div class="contract-grid">
      {#each pillar.contract as rule, index (rule)}
        <article><span>{String(index + 1).padStart(2, "0")}</span><p>{rule}</p></article>
      {/each}
    </div>
  </section>

  <section class="pillar-section">
    <div class="pillar-section-heading">
      <div><span>02</span><h2>Representative infraction</h2></div>
      <p>One concrete instance, followed by the general architectural diagnosis.</p>
    </div>
    <article class="infraction-card">
      <header>
        <div><TriangleAlert size={18} aria-hidden="true" /><span>Current source example</span></div>
        <code>{pillar.example.source}</code>
      </header>
      <div class="infraction-title">
        <h3>{pillar.example.title}</h3>
        <p>{pillar.example.observed}</p>
      </div>
      <pre><code>{pillar.example.shape}</code></pre>
      <div class="diagnosis-grid">
        <div><span>Why it antagonizes the design</span><p>{pillar.example.antagonism}</p></div>
        <div class="repair"><span>General repair</span><p>{pillar.example.repair}</p></div>
      </div>
      {#if pillar.example.nuance}
        <aside><strong>Important nuance</strong><p>{pillar.example.nuance}</p></aside>
      {/if}
    </article>
  </section>

  <section class="pillar-section">
    <div class="pillar-section-heading">
      <div><span>03</span><h2>The equivalence class</h2></div>
      <p>These are grouped because one architectural rule and one repair strategy explain all of them.</p>
    </div>
    <div class="equivalence-panel">
      <div class="equivalence-rule"><Equal size={20} aria-hidden="true" /><div><span>Shared rule</span><p>{pillar.equivalence.rule}</p></div></div>
      <div class="equivalence-members">
        {#each pillar.equivalence.members as member (member)}<span>{member}</span>{/each}
      </div>
      <div class="equivalence-repair"><strong>One general repair</strong><p>{pillar.equivalence.generalRepair}</p></div>
    </div>
  </section>

  <section class="pillar-section">
    <div class="pillar-section-heading">
      <div><span>04</span><h2>Desired operational flow</h2></div>
      <p>The flow a reviewer should be able to recover from directory names and public entry points.</p>
    </div>
    <div class="desired-flow">
      {#each pillar.desiredFlow as step, index (step)}
        <div><span>{index + 1}</span><p>{step}</p></div>
        {#if index < pillar.desiredFlow.length - 1}<ArrowRight size={16} aria-hidden="true" />{/if}
      {/each}
    </div>
  </section>

  <section class="pillar-section">
    <div class="pillar-section-heading">
      <div><span>05</span><h2>Checker specification</h2></div>
      <p>“Enforced” means the current checker directly proves the stated guarantee. “Partial” means it only checks a proxy or subset.</p>
    </div>
    <div class="checker-list">
      {#each pillar.checkers as checker (checker.id)}
        <CheckerCard {checker} />
      {/each}
    </div>
  </section>

  <section class="pillar-section">
    <div class="pillar-section-heading">
      <div><span>06</span><h2>Rollout for this pillar</h2></div>
      <p>Monitoring lands before broad refactoring, with current debt baselined and every new infraction blocked.</p>
    </div>
    <ol class="pillar-rollout">
      {#each pillar.rollout as step, index (step)}
        <li><span>{index + 1}</span><p>{step}</p></li>
      {/each}
    </ol>
  </section>

  <section class="pillar-section detail-links">
    <a href="/demo/state-behavior-audit"><Check size={16} aria-hidden="true" /><span><small>Source evidence</small>Open the complete audit</span></a>
    <a href="/demo/architecture-pillars/checking-system"><ShieldCheck size={16} aria-hidden="true" /><span><small>Enforcement design</small>Open the checking system</span></a>
    <a href="/demo/architecture-pillars/{next.slug}"><ArrowRight size={16} aria-hidden="true" /><span><small>Next pillar</small>{next.name}</span></a>
  </section>

  <footer class="pillars-footer"><span>{pillar.code} · {pillar.slug}</span><a href="/demo/architecture-pillars">Architecture pillars</a></footer>
</main>
