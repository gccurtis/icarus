# ContextSection.svelte

The collapsible **Context** disclosure shown above both the chat list and the transcript. It
owns the `<details>` frame and composes the three things inside it: the "Current context"
button (the door into the manager — the `onmanage` callback is its only prop, flipped by the
panel), the [`ContextSources`](ContextSources.svelte.md) grid, and
[`ContextAttachments`](ContextAttachments.svelte.md).

The `<style>` block hides the native `::-webkit-details-marker` so the rotating chevron is the
only affordance; `group-open:rotate-180` turns it when the disclosure opens.
