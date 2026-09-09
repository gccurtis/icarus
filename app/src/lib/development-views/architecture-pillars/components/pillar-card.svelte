<script lang="ts">
  import ArrowRight from "@lucide/svelte/icons/arrow-right";

  import type { ArchitecturePillar } from "$development-views/architecture-pillars/types";

  let { pillar }: { pillar: ArchitecturePillar } = $props();

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

<a class="pillar-card" href="/demo/architecture-pillars/{pillar.slug}">
  <div class="pillar-card-meta"><code>{pillar.code}</code><span>{pillar.checkers.length} checkers</span></div>
  <h3>{pillar.name}</h3>
  <p>{pillar.short}</p>
  <div class="pillar-coverage" aria-label="Checker coverage">
    <span class="coverage-enforced">{enforced} enforced</span>
    <span class="coverage-partial">{partial} partial</span>
    <span class="coverage-missing">{missing} missing</span>
  </div>
  <span class="pillar-open">Open pillar <ArrowRight size={14} aria-hidden="true" /></span>
</a>
