<script lang="ts">
  let {
    path,
    label,
    role,
    source,
    open = false
  }: {
    path: string;
    label: string;
    role: string;
    source: string;
    open?: boolean;
  } = $props();

  const lines = $derived(source.replace(/\n$/, "").split("\n"));
</script>

<details class="pf-code-file" {open}>
  <summary>
    <span class="pf-code-toggle" aria-hidden="true">+</span>
    <span class="pf-code-heading">
      <strong>{label}</strong>
      <code>{path}</code>
    </span>
    <span class="pf-code-meta">{lines.length} lines</span>
  </summary>
  <p class="pf-code-role">{role}</p>
  <pre aria-label={`Source code for ${path}`}><code>{#each lines as line, index (index)}<span class="pf-code-line"><span class="pf-line-number">{String(index + 1).padStart(3, "0")}</span><span class="pf-line-source">{line || " "}</span></span>{/each}</code></pre>
</details>
