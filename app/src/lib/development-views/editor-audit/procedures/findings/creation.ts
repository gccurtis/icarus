import type { Finding } from "$development-views/editor-audit/types";

export const CREATION_FINDINGS: readonly Finding[] = [
  {
    id: "CRT-01",
    area: "Creation and runtime",
    severity: "P0",
    status: "Fixed in this audit",
    title: "Runtime JSON writes reloaded the localhost workspace",
    symptom: "Create and comment commands could reload the app while a command was still opening or updating a tab.",
    cause: "Vite watched app/data/*.json even though those files are the represented runtime store, so each persisted row looked like a source edit.",
    fix: "Ignore **/data/** in the Vite watcher and let remote-query invalidation update mounted UI.",
    acceptance: "Creating resources and comments leaves the active tab stable without a full-page reload.",
    evidence: ["vite.config.ts", "model/server/store/constructor.ts"]
  },
  {
    id: "CRT-02",
    area: "Creation and runtime",
    severity: "P0",
    status: "Fixed in this audit",
    title: "Creation refreshed the board but not the editor title query",
    symptom: "A newly opened resource had a valid opaque ID but could retain a loading or disconnected title.",
    cause: "Creation invalidated the merged project index only; the title bars read the documents or presentations table directly.",
    fix: "Refresh the index and the target editor's workspace-owned table query before opening the returned ID.",
    acceptance: "A new tab is keyed by an opaque ID and immediately shows its allocated Untitled title.",
    evidence: ["project-overview/procedures/resources.ts", "new-tab/procedures/creating.ts"]
  },
  {
    id: "CRT-03",
    area: "Creation and runtime",
    severity: "P0",
    status: "Fixed in this audit",
    title: "A represented new presentation contained zero slides",
    symptom: "The presentation editor opened a blank plane with no canvas or thumbnail.",
    cause: "The valid revision-zero snapshot stored slides: [], bypassing the runtime fallback used only when no snapshot exists.",
    fix: "Persist one real empty slide with a collision-resistant ID in every directly created presentation.",
    acceptance: "A new presentation opens with one editable canvas and one thumbnail.",
    evidence: ["project-resources/api/create-project-resource/create-project-resource.ts"]
  },
  {
    id: "CRT-04",
    area: "Creation and runtime",
    severity: "P0",
    status: "Fixed in this audit",
    title: "New Tab opened invented IDs instead of creating resources",
    symptom: "The launcher could display a document or presentation that had no represented row or leader snapshot.",
    cause: "It generated an Untitled label locally and passed that label to view.open as if it were an ID.",
    fix: "Route Document and Presentation through Project Resources and open only the returned resource ID.",
    acceptance: "Both launchers create durable represented resources; Spreadsheet remains an explicit not-wired alert.",
    evidence: ["new-tab/content/launcher.svelte", "project-resources/index.remote.ts"]
  },
  {
    id: "CRT-05",
    area: "Creation and runtime",
    severity: "P0",
    status: "Fixed in this audit",
    title: "A new document displayed a paragraph absent from its snapshot",
    symptom: "The blank page showed a caret, but the first keystroke could fail because its block existed only in the client projection.",
    cause: "Revision zero stored rows: []; ProseMirror minted a display-only paragraph that durable operations could not address.",
    fix: "Persist a real first row, text block, and empty literal atom with collision-resistant IDs.",
    acceptance: "The first keystroke creates a valid revision and remains after a full reload.",
    evidence: ["project-resources/api/create-project-resource/create-project-resource.ts", "document-editor/procedures/translate.ts"]
  },
  {
    id: "CRT-06",
    area: "Creation and runtime",
    severity: "P0",
    status: "Fixed in this audit",
    title: "Buffered edits were labeled Saved before persistence",
    symptom: "A newly created document could say Saved immediately after typing and reopen empty if reloaded during the debounce window.",
    cause: "The document and presentation runtimes changed the optimistic body and buffer but did not change sync state until the delayed flush started.",
    fix: "Set sync to Saving when a valid operation enters the buffer; Saved is restored only after server acceptance and refresh.",
    acceptance: "Typing visibly transitions Saving to Saved, and text reopens after the Saved state is reached.",
    evidence: ["document-runtimes/methods/apply.ts", "presentation-runtimes/methods/apply.ts", "resource-creation.spec.ts"]
  }
];
