# Transcript.svelte

The conversation transcript: one block per message, tinted by author — agent messages get the
intel-colored left border and a "Taurus" byline, user messages the neutral border and "You".
Bodies render `whitespace-pre-wrap`, so the model's line breaks survive without allowing
markup. Below the messages, a "Working…" line shows while `$aiAgent.sending`; both the list
and the indicator are `aria-live="polite"` so screen readers hear new turns.
