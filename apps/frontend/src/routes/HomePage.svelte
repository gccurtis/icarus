<script lang="ts">
  import { Badge } from "#simple-components/badge";
  import { Button } from "#simple-components/button";
  import * as Card from "#simple-components/card";

  /**
   * What this frontend expects back from the backend's /health endpoint. The
   * backend owns the payload; this is our independent declaration of it, so the
   * two are not checked against each other by the compiler.
   */
  interface ApiHealth {
    service: "backend";
    status: "ok";
    timestamp: string;
  }

  type Probe =
    | { state: "idle" }
    | { state: "resolving" }
    | { state: "applied"; health: ApiHealth }
    | { state: "failed"; reason: string };

  let probe = $state<Probe>({ state: "idle" });

  async function checkHealth(): Promise<void> {
    probe = { state: "resolving" };
    try {
      const response = await fetch("http://localhost:4000/health");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      probe = { state: "applied", health: (await response.json()) as ApiHealth };
    } catch (error) {
      probe = { state: "failed", reason: error instanceof Error ? error.message : String(error) };
    }
  }

  void checkHealth();
</script>

<div class="mx-auto flex max-w-3xl flex-col gap-6 p-8">
  <header class="flex flex-col gap-2">
    <h1 class="text-h1 font-semibold">Icarus</h1>
    <p class="text-body text-ink-secondary">
      Frontend shell. The backend contract is checked below — the two sides are independent, so
      nothing verifies this at compile time.
    </p>
  </header>

  <Card.Root>
    <Card.Header>
      <Card.Title>Backend health</Card.Title>
      <Card.Description>GET http://localhost:4000/health</Card.Description>
      <Card.Action>
        <Button variant="outline" size="sm" onclick={checkHealth}>Refresh</Button>
      </Card.Action>
    </Card.Header>
    <Card.Content>
      <!--
        Per docs/style/component/components-and-states.md, every state pairs its
        color with copy and an icon-or-equivalent. Color never carries it alone.
      -->
      {#if probe.state === "resolving"}
        <div class="flex items-center gap-2">
          <Badge variant="secondary">Resolving</Badge>
          <span class="text-body-sm text-ink-secondary">Contacting the backend…</span>
        </div>
      {:else if probe.state === "applied"}
        <div class="flex flex-col gap-2">
          <div class="flex items-center gap-2">
            <Badge class="bg-success-normal text-ink-on-fill">Applied</Badge>
            <span class="text-body-sm text-ink-secondary">
              {probe.health.service} reported {probe.health.status}
            </span>
          </div>
          <p class="text-caption text-ink-secondary font-mono tabular-nums">
            {probe.health.timestamp}
          </p>
        </div>
      {:else if probe.state === "failed"}
        <div class="flex flex-col gap-2">
          <div class="flex items-center gap-2">
            <Badge variant="destructive">Failed</Badge>
            <span class="text-body-sm text-ink-secondary">{probe.reason}</span>
          </div>
          <!-- A failure state without a recovery path is an accusation, not a state. -->
          <p class="text-caption text-ink-secondary">
            Start it with <code class="font-mono">cd apps/backend &amp;&amp; pnpm dev</code>, then
            refresh.
          </p>
        </div>
      {:else}
        <Badge variant="outline">Idle</Badge>
      {/if}
    </Card.Content>
  </Card.Root>
</div>
