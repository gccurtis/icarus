# Document editor

> Status: conceptual reference. Backend contracts and prototypes should determine the final editor engine and adapter design.

The document editor should feel like a normal, excellent writing surface first and a knowledge-aware Taurus surface second. Users should be able to write without managing system machinery, while derived content, sources, provenance, and agentic work remain visible and reviewable when relevant.

## Experience goals

- Typing, selection, navigation, undo, paste, lists, headings, links, tables, and familiar rich-text behavior should feel immediate.
- The document body remains calm. Live or derived objects are legible without turning the page into a dashboard.
- Taurus-specific capability appears through clear objects, commands, the inspector, and the AI Quarterback Surface.
- Every meaningful derived state is inspectable and recoverable.
- The user can always distinguish authored content, derived content, pending work, and accepted canonical content.

## Core mental model

The editor is an interaction surface over a backend-authoritative Document. It may render optimistically and preserve temporary local intent, but the browser is never the only place the complete resource exists.

Alpha owns:

- editor rendering and input mechanics;
- cursor, selection, composition, clipboard, drag, and local view state;
- temporary drafts and optimistic presentation;
- translating editor changes into typed product intent;
- synchronization, retry, and conflict presentation;
- accessible commands, menus, and inspector views.

Omega owns:

- the canonical document and revision;
- ordered content structure and stable identities;
- validation and version-checked mutation;
- prompt-block representation and accepted visible output;
- provenance, stale state, and authoritative conflicts;
- deterministic extraction and export.

An editor library is a rendering and transaction mechanism, not canonical storage.

## Content and live objects

The initial editor should support ordinary prose and the minimum block structure needed for a real document. The longer-term model may include paragraphs, headings, lists, tables, media, code, formulas, prompts, citations, and richer layout.

Prompt blocks are document-domain objects embedded in the work. They should expose a calm inline presentation while the inspector carries prompt, scope, sources, status, revision, refresh, and recovery detail.

Useful prompt-block states include:

- Resolved — a stable visible result is available.
- Resolving — computation is active and cancellable or inspectable.
- Stale — source change means the result needs judgment or refresh.
- Failed — the prior safe display remains where possible, with a recovery action.
- Selected — the object is unmistakably connected to its inspector.

Formula and knowledge-derived objects should follow the same trust pattern: clear input, clear output, explicit state, provenance where relevant, and a repair path.

## Editing and synchronization

Local editing should feel instant. Changes may be coalesced for synchronization, but confirmation, rejection, retry, and conflict must be represented honestly.

- Preserve cursor, selection, and scroll whenever reconciliation allows.
- Avoid whole-document replacement when a localized update can preserve the user's place.
- Never silently discard rejected or conflicting work.
- Make the difference between temporary local state and confirmed backend truth observable when it matters.
- After reconnect, reload authorized truth rather than guessing from missed notifications.

The exact transaction protocol belongs to the Alpha/Omega interface and should evolve from working vertical slices.

## Commands and inspection

Primary authoring actions need visible, keyboard-accessible paths. Slash commands, shortcuts, context menus, and command search can accelerate the interface, but they cannot be the only way to perform essential work.

The document context rail may expose outline, document resources, sources, history, and knowledge references. The inspector should reflect the selected paragraph, range, prompt block, formula, table, media object, or document-level state.

The AI Quarterback Surface should understand at least selection and document scope. It can ask, generate, edit the selection, delegate, or review, but must show consequence and result target before material action.

## Accessibility and trust

- The primary editing path must work by keyboard.
- Selection, focus, resolving, failure, and stale state cannot rely on color alone.
- Dynamic status should be announced without making every keystroke noisy.
- Agentic changes should be attributed, reviewable, and reversible.
- Errors should state what happened, whether work was preserved, and how to recover.
- Reduced-motion preferences should not remove state clarity.

## Incremental sequence

1. Load and render a canonical document.
2. Support excellent plain-text and basic rich-text editing.
3. Synchronize versioned changes and surface conflicts.
4. Add document tabs and restore local view state.
5. Add selection-aware inspection.
6. Add one honest prompt-block flow end to end.
7. Expand content types, commands, provenance, and review behavior as Omega contracts mature.

## Primary sources

- [Document Editor](https://app.notion.com/p/383b6410e502811f9e6ae55e38721ab6)
- [Document Runtime](https://app.notion.com/p/383b6410e5028128bf54f576c62d6ef0)
- [SOL X 69 — Document Editor Engine, Commands & Rendering](https://app.notion.com/p/39ab6410e50281898402fccf9bc270ed)
- [SOL Y 43 — Document Editor Engine & ProseMirror Bridge](https://app.notion.com/p/39ab6410e5028144848ec928c3434194)
- [Taurus Omega — Product Vision & Architecture Synthesis](https://app.notion.com/p/3a0b6410e5028116840ade3f8c41da41)
