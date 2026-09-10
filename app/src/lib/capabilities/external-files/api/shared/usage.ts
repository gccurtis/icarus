import type { StoreUnitOfWork } from "$model/server/store/index.server";
import type { Scope } from "$runtime/server/start.server";

import {
  contentBlocksNameExternalFile,
  documentBodyNamesExternalFile,
  formulaValueNamesExternalFile,
  refNamesExternalFile,
  resourceSetNamesExternalFile,
  sheetCellNamesExternalFile,
  slideDeckBodyNamesExternalFile,
  templateBodyNamesExternalFile
} from "$capabilities/external-files/api/shared/resource-references";
import { rowsOf } from "$capabilities/external-files/api/shared/rows";
import type {
  ExternalFileUsage,
  ExternalFileUsageItem,
  ExternalFileUsageKind
} from "$capabilities/external-files/types/external-files";

const unique = (items: readonly ExternalFileUsageItem[]): ExternalFileUsageItem[] =>
  [...new Map(items.map((item) => [`${item.kind}:${item.id}`, item])).values()];

/**
 * Central deletion-policy traversal for live, identity-bearing references.
 *
 * Deliberately excluded are activity, change sets, non-leader snapshots,
 * template versions, semantic histories/caches, and Derived Output evidence.
 * Those records preserve a by-value historical account and must remain readable
 * after the current External identity is removed. Workspace focus is transient
 * navigation state, not represented content, and is also non-blocking.
 */
export const externalFileUsage = (
  store: StoreUnitOfWork,
  scope: Scope,
  externalFileId: string
): ExternalFileUsage => {
  const items: ExternalFileUsageItem[] = [];
  const push = (kind: ExternalFileUsageKind, id: string, name: string) =>
    items.push({ kind, id, name });
  const inProject = <T extends { readonly projectId: string }>(row: T): boolean =>
    row.projectId === scope.projectId;

  const documents = new Map(rowsOf(store, "documents")
    .filter(inProject)
    .map((row) => [row._id, row.title]));
  for (const snapshot of rowsOf(store, "documentSnapshots")) {
    if (
      !inProject(snapshot) ||
      snapshot.role !== "leader" ||
      !documentBodyNamesExternalFile(snapshot.body, externalFileId)
    ) continue;
    push("document", snapshot.resourceId, documents.get(snapshot.resourceId) ?? "Untitled document");
  }

  const decks = new Map(rowsOf(store, "slideDecks")
    .filter(inProject)
    .map((row) => [row._id, row.title]));
  for (const snapshot of rowsOf(store, "slideDeckSnapshots")) {
    if (
      !inProject(snapshot) ||
      snapshot.role !== "leader" ||
      !slideDeckBodyNamesExternalFile(snapshot.body, externalFileId)
    ) continue;
    push("slide-deck", snapshot.resourceId, decks.get(snapshot.resourceId) ?? "Untitled deck");
  }

  const spreadsheets = new Map(rowsOf(store, "spreadsheets")
    .filter(inProject)
    .map((row) => [row._id, row.title]));
  for (const cell of rowsOf(store, "sheetCells")) {
    if (!inProject(cell) || !sheetCellNamesExternalFile(cell, externalFileId)) continue;
    push(
      "spreadsheet",
      cell.resourceId,
      spreadsheets.get(cell.resourceId) ?? "Untitled spreadsheet"
    );
  }

  let restrictedTemplate = 0;
  for (const template of rowsOf(store, "templates")) {
    if (!inProject(template) || !templateBodyNamesExternalFile(template.body, externalFileId)) continue;
    if (template.userId === scope.userId) {
      push("template", template._id, template.name);
    } else {
      restrictedTemplate += 1;
      push("template", `restricted-${restrictedTemplate}`, "A private template");
    }
  }

  for (const set of rowsOf(store, "resourceSets")) {
    if (!inProject(set) || !resourceSetNamesExternalFile(set.set, externalFileId)) continue;
    push("resource-set", set._id, set.name ?? "Bound resource set");
  }

  for (const finding of rowsOf(store, "findings")) {
    if (!inProject(finding)) continue;
    const named = contentBlocksNameExternalFile(finding.body, externalFileId) ||
      finding.sources.some((source) =>
        source.kind === "resource" && refNamesExternalFile(source.ref, externalFileId)
      );
    if (named) push("finding", finding._id, finding.title);
  }
  for (const question of rowsOf(store, "questions")) {
    if (inProject(question) && contentBlocksNameExternalFile(question.notes, externalFileId)) {
      push("question", question._id, question.text);
    }
  }
  for (const hypothesis of rowsOf(store, "hypotheses")) {
    if (inProject(hypothesis) && contentBlocksNameExternalFile(hypothesis.notes, externalFileId)) {
      push("hypothesis", hypothesis._id, hypothesis.statement);
    }
  }

  for (const thread of rowsOf(store, "commentThreads")) {
    if (inProject(thread) && refNamesExternalFile(thread.target, externalFileId)) {
      push("comment", thread._id, "Comment thread");
    }
  }
  for (const comment of rowsOf(store, "comments")) {
    if (!inProject(comment)) continue;
    const named = contentBlocksNameExternalFile(comment.blocks, externalFileId) ||
      comment.mentions.some((mention) =>
        mention.kind === "resource" && refNamesExternalFile(mention.ref, externalFileId)
      );
    if (named) push("comment", comment._id, "Comment");
  }

  const researchThreads = new Map(rowsOf(store, "researchThreads")
    .filter(inProject)
    .map((row) => [row._id, row.title]));
  for (const turn of rowsOf(store, "researchTurns")) {
    if (!inProject(turn)) continue;
    const named = (
      turn.scope.kind === "resource" && refNamesExternalFile(turn.scope.ref, externalFileId)
    ) || turn.sources.some((source) => refNamesExternalFile(source.ref, externalFileId)) ||
      contentBlocksNameExternalFile(turn.blocks, externalFileId);
    if (named) {
      push(
        "research",
        turn.researchThreadId,
        researchThreads.get(turn.researchThreadId) ?? "Research thread"
      );
    }
  }

  for (const part of rowsOf(store, "threadParts")) {
    if (!inProject(part)) continue;
    const named = part.messages.some((message) =>
      contentBlocksNameExternalFile(message.blocks, externalFileId) ||
      (message.attachments ?? []).some((ref) => refNamesExternalFile(ref, externalFileId))
    );
    if (named) push("thread", part.threadId, "Conversation");
  }

  for (const persona of rowsOf(store, "personas")) {
    if (
      inProject(persona) &&
      persona.scope !== undefined &&
      resourceSetNamesExternalFile(persona.scope, externalFileId)
    ) push("persona", persona._id, persona.name);
  }
  for (const task of rowsOf(store, "agentTasks")) {
    if (!inProject(task)) continue;
    const named = (
      task.scope !== undefined && resourceSetNamesExternalFile(task.scope, externalFileId)
    ) || task.outputs.some((output) =>
      output.ref !== undefined && refNamesExternalFile(output.ref, externalFileId)
    ) || (
      task.origin.kind === "automation" &&
      task.origin.ref !== undefined &&
      refNamesExternalFile(task.origin.ref, externalFileId)
    );
    if (named) push("agent-task", task._id, task.title);
  }
  for (const automation of rowsOf(store, "automations")) {
    if (!inProject(automation)) continue;
    const named = (
      automation.scope !== undefined &&
      resourceSetNamesExternalFile(automation.scope, externalFileId)
    ) || (
      automation.trigger.kind === "resource-edited" &&
      automation.trigger.ref !== undefined &&
      refNamesExternalFile(automation.trigger.ref, externalFileId)
    );
    if (named) push("automation", automation._id, automation.name);
  }

  for (const output of rowsOf(store, "derivedOutputs")) {
    if (!inProject(output)) continue;
    const named = (
      output.origin !== undefined && refNamesExternalFile(output.origin, externalFileId)
    ) || (
      output.scope !== undefined && resourceSetNamesExternalFile(output.scope, externalFileId)
    ) || (output.template?.variables.some((variable) =>
      variable.origin !== undefined && refNamesExternalFile(variable.origin, externalFileId)
    ) ?? false) || (
      output.lastResponse !== undefined &&
      contentBlocksNameExternalFile([output.lastResponse], externalFileId)
    );
    if (named) push("derived-output", output._id, output.prompt.slice(0, 80) || "Derived output");
  }
  for (const job of rowsOf(store, "derivedOutputRefreshJobs")) {
    if (
      inProject(job) &&
      job.selection !== undefined &&
      refNamesExternalFile(job.selection.ref, externalFileId)
    ) push("derived-output", job.derivedOutputId, "Derived output refresh");
  }

  for (const variable of rowsOf(store, "variables")) {
    if (inProject(variable) && formulaValueNamesExternalFile(variable.value, externalFileId)) {
      push("variable", variable._id, variable.name);
    }
  }
  for (const formula of rowsOf(store, "formulas")) {
    if (!inProject(formula)) continue;
    const named = formula.usedBy.some((use) =>
      use.in === "resource" && refNamesExternalFile(use.ref, externalFileId)
    );
    if (named) push("formula", formula._id, formula.representation.slice(0, 80) || "Formula");
  }

  const held = unique(items).sort((left, right) =>
    left.kind.localeCompare(right.kind) || left.name.localeCompare(right.name)
  );
  return { total: held.length, items: held };
};
