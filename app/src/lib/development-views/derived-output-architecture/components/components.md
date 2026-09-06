# Derived Output architecture components

`mermaid-diagram.svelte` renders constant, trusted Mermaid definitions on the
client. The dependency is dynamically imported so Mermaid is not part of the
normal editor bundle; these development routes receive their own lazy chunk.

The renderer is deliberately local to this development view. It is a diagram
tool for architecture communication, not an authored-content primitive or a
promise that product documents support Mermaid.
