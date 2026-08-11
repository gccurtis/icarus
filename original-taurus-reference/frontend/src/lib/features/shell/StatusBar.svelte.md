# src/lib/features/shell/StatusBar.svelte — breakdown

Companion to [StatusBar.svelte](StatusBar.svelte). The thin infrastructural strip
at the very bottom of the shell (placeholder content for now).

## Component

### Sync indicator and product mark

```svelte
<script lang="ts">
  import { StatusDot } from '$lib/components';
</script>

<footer
  class="surface-panel flex h-status shrink-0 items-center gap-3 border-t border-border px-3 text-caption text-muted"
>
  <span class="flex items-center gap-1.5"><StatusDot tone="success" size={7} /> Synced</span>
  <span class="ml-auto font-mono">Taurus</span>
</footer>
```

A `surface-panel` footer at the `h-status` (24px) shell height. It shows a green
`StatusDot` + "Synced" on the left and a muted "Taurus" mark on the right — quiet,
subordinate chrome. This is where connection / sync / review state will surface
later.
