<script lang="ts">
  import type { CheckerSpec } from "$development-views/architecture-pillars/types";

  let { checker }: { checker: CheckerSpec } = $props();
</script>

<details class="checker-card" open={checker.wave === 1 && checker.status !== "Enforced"}>
  <summary>
    <code>{checker.id}</code>
    <span class="checker-status status-{checker.status.toLowerCase()}">{checker.status}</span>
    <strong>{checker.name}</strong>
    <span class="checker-wave">Wave {checker.wave}</span>
  </summary>
  <div class="checker-body">
    <div class="checker-guarantee">
      <span>Green means</span>
      <p>{checker.guarantee}</p>
    </div>
    <dl>
      <div><dt>Mechanism</dt><dd>{checker.mechanism}</dd></div>
      <div><dt>Detects</dt><dd>{checker.detects}</dd></div>
      <div><dt>Implementation</dt><dd>{checker.implementation}</dd></div>
      <div><dt>Current coverage</dt><dd>{checker.current}</dd></div>
      <div class="checker-limit"><dt>Deliberate limit</dt><dd>{checker.limit}</dd></div>
    </dl>
  </div>
</details>
