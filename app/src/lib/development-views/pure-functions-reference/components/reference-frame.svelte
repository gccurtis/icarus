<script lang="ts">
  import type { Snippet } from "svelte";

  import type { ReferencePage } from "$development-views/pure-functions-reference/types";
  import "$development-views/pure-functions-reference/components/reference.css";

  let {
    page,
    children
  }: {
    page: ReferencePage;
    children: Snippet;
  } = $props();
</script>

<div class="pf-reference">
  <nav class="pf-subnav" aria-label="Pure functions reference">
    <div>
      <span class="pf-mark">PF</span>
      <span class="pf-subnav-title">Pure islands</span>
    </div>
    <div class="pf-subnav-links">
      <a href="/demo/pure-functions" aria-current={page === "system" ? "page" : undefined}>
        System contract
      </a>
      <a
        href="/demo/pure-functions/configuration"
        aria-current={page === "configuration" ? "page" : undefined}
      >
        Configuration model
      </a>
    </div>
    <span class="pf-branch">work/pure-functions</span>
  </nav>

  {@render children()}

  <footer class="pf-footer">
    <span>Pure islands · living implementation reference</span>
    <nav aria-label="Reference pages">
      <a href="/demo/pure-functions">Contract</a>
      <a href="/demo/pure-functions/configuration">Converted model</a>
      <a href="/demo">All demos</a>
    </nav>
  </footer>
</div>
