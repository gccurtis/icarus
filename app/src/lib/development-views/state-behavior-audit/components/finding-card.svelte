<script lang="ts">
  import type { AuditFinding } from "$development-views/state-behavior-audit/types";

  let { finding }: { finding: AuditFinding } = $props();
</script>

<details class="architecture-finding" open={finding.priority === "P0"}>
  <summary>
    <code>{finding.id}</code>
    <span class="finding-priority priority-{finding.priority.toLowerCase()}">{finding.priority}</span>
    <span class="finding-area">{finding.area}</span>
    <strong>{finding.title}</strong>
  </summary>
  <div class="architecture-finding-body">
    <dl>
      <div>
        <dt>Finding</dt>
        <dd>{finding.finding}</dd>
      </div>
      <div>
        <dt>Why it matters</dt>
        <dd>{finding.consequence}</dd>
      </div>
      <div>
        <dt>Recommended boundary</dt>
        <dd>{finding.recommendation}</dd>
      </div>
      <div class="finding-acceptance">
        <dt>Resolved when</dt>
        <dd>{finding.acceptance}</dd>
      </div>
    </dl>
    <div class="architecture-evidence">
      <span>Evidence</span>
      {#each finding.evidence as item (item)}
        <code>{item}</code>
      {/each}
    </div>
  </div>
</details>
