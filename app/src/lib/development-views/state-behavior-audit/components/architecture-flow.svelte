<script lang="ts">
  import ArrowRight from "@lucide/svelte/icons/arrow-right";
  import Database from "@lucide/svelte/icons/database";
  import Layers from "@lucide/svelte/icons/layers";
  import Monitor from "@lucide/svelte/icons/monitor";
  import Server from "@lucide/svelte/icons/server";
</script>

<div class="architecture-flow" aria-label="Target state and behavior call path">
  <article>
    <span class="flow-icon"><Monitor size={18} aria-hidden="true" /></span>
    <small>Presentation</small>
    <strong>Component</strong>
    <p>Declares props, derives presentation, binds markup, and calls named local procedures.</p>
  </article>
  <ArrowRight class="flow-arrow" size={18} aria-hidden="true" />
  <article>
    <span class="flow-icon"><Layers size={18} aria-hidden="true" /></span>
    <small>Client behavior</small>
    <strong>Procedure</strong>
    <p>Interprets one gesture or effect and changes an explicit component, workspace, or runtime owner.</p>
  </article>
  <ArrowRight class="flow-arrow" size={18} aria-hidden="true" />
  <article>
    <span class="flow-icon"><Server size={18} aria-hidden="true" /></span>
    <small>Server behavior</small>
    <strong>Capability</strong>
    <p>Resolves scope, validates intent, and invokes subject-specific server behavior.</p>
  </article>
  <ArrowRight class="flow-arrow" size={18} aria-hidden="true" />
  <article>
    <span class="flow-icon"><Database size={18} aria-hidden="true" /></span>
    <small>Durable state</small>
    <strong>Server model</strong>
    <p>Owns process resources, transactions, persistence, and durable invariants.</p>
  </article>
</div>

<p class="flow-branch">
  A client-only procedure stops at its client owner. A remote procedure crosses exactly once, at a
  capability. No component reaches persistence and no capability keeps user state.
</p>
