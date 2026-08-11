# Architecture

Conceptual → implementation maps for the repo's substantial subsystems. Each entry
explains how a subsystem **works as a set of ideas**, then maps every idea down to the
**exact module, file, and function** that carries it out — so you can go from "how does
this work?" to "where is that handled?" without reading the whole codebase.

## How this differs from the other docs

| Doc | Question it answers |
| --- | --- |
| **architecture/** (here) | How does this subsystem work, and where is each concept implemented? |
| `.md` companions (beside source) | What does this one file do, line by line? |
| [records/](../archive/records/) | What changed, when, and why? |
| [roadmap/](../roadmap/README.md) | What are we building next, and what did we decide against? |
| [backend-requests/](../backend-requests/README.md) | What should Omega build next? |
| [orientation/](../orientation/README.md) | I'm new — orient me to the whole repo. |

An architecture entry is the **top of the reading path** for its subsystem: read it
first, then the companions of the files it names, then the linked discrepancy docs.

## Keeping entries honest

- Name real modules, files, and functions — never describe code that doesn't exist.
- When the code changes shape (new module, moved responsibility, new invariant),
  update the entry **in the same change**, like a companion.
- Design intent that is *not yet built* belongs in a clearly-marked "next increments"
  section, never mixed into the description of what exists.

## Entries

- [document-editor.md](document-editor.md) — the ProseMirror ↔ Omega change-set
  editor: layer model, data flow, identity/sync invariants, and the extension map.
- [document-block-and-style-model.md](document-block-and-style-model.md) — the block
  half of the same subsystem: the seven kinds and the text sub-kind, the two typography
  systems (semantic tokens and real fonts), and the cascade that resolves them.
