# ContextSources.svelte

The selectable context sources as a compact checkbox grid — rendered by *both* the Context
disclosure (`ContextSection`) and the Current-context manager (`ContextManager`), so a source
toggle looks and behaves identically in the two places it appears.

Each cell is a `<label>` wrapping a visually hidden checkbox (`peer sr-only`) with a custom
check square, the source's icon (document / selection / knowledge / linked sources), its label,
and a `MockBadge` when the option declares `wired: false`. The whole cell is the hit target;
a `Tooltip` carries the source's one-line `detail`. Toggling calls `toggleAiContextSource`
straight on the store — no props, like the document panels' controls.
