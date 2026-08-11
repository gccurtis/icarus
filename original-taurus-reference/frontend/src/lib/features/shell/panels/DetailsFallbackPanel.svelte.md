# src/lib/features/shell/panels/DetailsFallbackPanel.svelte — breakdown

Companion to [DetailsFallbackPanel.svelte](DetailsFallbackPanel.svelte). The universal
**Details** section's fallback content — Details is a *permanent* inspector section
(always present, always first, the default); when the active surface contributes its
own `details` section, that lens replaces this fallback.

## The panel

```svelte
<!-- Universal Details fallback: shown when no surface contributes a Details lens.
     The intentional no-selection default (never a generic settings drawer). -->
<p class="text-body-sm text-muted">
  Nothing to inspect yet — open a resource and select something; its details appear
  here.
</p>
```
