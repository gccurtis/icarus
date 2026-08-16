<script lang="ts">
  /**
   * What a `project-overview` resource renders as.
   *
   * The permanent tab's kind, so this is what the work surface shows on a first
   * load and whenever every transient tab has been closed. It has no content of
   * its own yet: a project summary needs capabilities that do not exist, and the
   * Convex round trip that used to occupy this space was a transport probe
   * rather than a surface — it lives at `/mock/[project]` now.
   *
   * What it does is make the workspace's key map total and reachable: one
   * `ResourceKind`, one component, resolved rather than branched.
   */
</script>

<div class="overview">
  <p class="note">Nothing open.</p>
</div>

<style>
  .overview {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: calc(var(--token-spacing-unit) * 6);
  }

  .note {
    font-size: var(--token-text-body-sm);
    color: var(--token-ink-muted);
    margin: 0;
  }
</style>
