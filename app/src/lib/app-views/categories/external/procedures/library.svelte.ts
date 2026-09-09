import {
  readExternalFile,
  readExternalFileLibrary,
  removeExternalFile as removeExternalFileRemote,
  renameExternalFile as renameExternalFileRemote,
  uploadExternalFiles,
  type ExternalFileDetail,
  type ExternalFileLibraryItem,
  type ReadExternalFileLibraryResult,
  type ReadExternalFileResult
} from "$capabilities/external-files/index.remote";
import {
  enqueueSemanticSync,
  processSemanticSyncQueue
} from "$capabilities/semantic-overlay/index.remote";
import type { WorkspaceStateModel } from "$model/client/workspace-state";

export type LibraryExternalFile = ExternalFileLibraryItem & {
  readonly updated: string;
  readonly sizeLabel: string;
  readonly semanticLabel: string;
  readonly semanticTone: "current" | "queued" | "failed" | "limited" | "idle";
};

export type LibraryExternalFileDetail = ExternalFileDetail & {
  readonly updated: string;
  readonly sizeLabel: string;
  readonly semanticLabel: string;
  readonly semanticTone: "current" | "queued" | "failed" | "limited" | "idle";
};

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const relativeTime = (at: number, now: number): string => {
  const gap = Math.max(0, now - at);
  if (gap < MINUTE) return "just now";
  if (gap < HOUR) {
    const minutes = Math.max(1, Math.round(gap / MINUTE));
    return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  }
  if (gap < DAY) {
    const hours = Math.max(1, Math.round(gap / HOUR));
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }
  if (gap < 2 * DAY) return "yesterday";
  if (gap < 30 * DAY) return `${Math.round(gap / DAY)} days ago`;
  return new Date(at).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
};

export const bytesLabel = (value: number | null): string => {
  if (value === null) return "Unknown";
  if (value < 1_000) return `${value} B`;
  if (value < 1_000_000) return `${(value / 1_000).toFixed(value < 10_000 ? 1 : 0)} KB`;
  if (value < 1_000_000_000) {
    return `${(value / 1_000_000).toFixed(value < 10_000_000 ? 1 : 0)} MB`;
  }
  return `${(value / 1_000_000_000).toFixed(1)} GB`;
};

export const semanticPresentation = (
  row: ExternalFileLibraryItem
): Pick<LibraryExternalFile, "semanticLabel" | "semanticTone"> => {
  const states = [row.semantic.exact.state, row.semantic.material.state];
  if (states.includes("running")) return { semanticLabel: "Processing", semanticTone: "queued" };
  if (states.includes("queued")) return { semanticLabel: "Queued", semanticTone: "queued" };
  if (states.includes("failed")) return { semanticLabel: "Needs attention", semanticTone: "failed" };
  if (states.includes("stale")) return { semanticLabel: "Refresh needed", semanticTone: "failed" };
  if (row.semantic.material.descriptor !== undefined) {
    return { semanticLabel: "Summary ready", semanticTone: "current" };
  }
  if (states.includes("current")) {
    return {
      semanticLabel: row.semantic.exact.state === "current" ? "Search ready" : "Profile ready",
      semanticTone: "current"
    };
  }
  if (states.every((state) => state === "unsupported")) {
    return { semanticLabel: "Managed only", semanticTone: "limited" };
  }
  return { semanticLabel: "Not processed", semanticTone: "idle" };
};

const project = (row: ExternalFileLibraryItem, now: number): LibraryExternalFile => ({
  ...row,
  updated: relativeTime(row.updatedAt, now),
  sizeLabel: bytesLabel(row.size),
  ...semanticPresentation(row)
});

export const externalFileLibrary = () => readExternalFileLibrary();
export const externalFileUpload = uploadExternalFiles;

export const externalFilesIn = (
  answer: ReadExternalFileLibraryResult | undefined,
  now: number
): readonly LibraryExternalFile[] => answer?.files.map((row) => project(row, now)) ?? [];

export const externalFileDetail = (externalFileId: string | undefined) =>
  externalFileId === undefined ? undefined : readExternalFile({ externalFileId });

export const detailIn = (
  answer: ReadExternalFileResult | undefined,
  now: number
): LibraryExternalFileDetail | undefined => {
  if (answer === null || answer === undefined || "unavailable" in answer) return undefined;
  return { ...answer, ...project(answer, now) };
};

export const unavailableIn = (answer: ReadExternalFileResult | undefined) =>
  answer !== null && answer !== undefined && "unavailable" in answer ? answer : undefined;

export const selectedExternalFileIdIn = (
  selectedId: string | undefined,
  availableIds: readonly string[]
): string | undefined =>
  selectedId !== undefined && availableIds.includes(selectedId) ? selectedId : undefined;

export const inspectExternalFile = (view: WorkspaceStateModel, externalFileId: string): void => {
  view.open({ category: "external", focus: externalFileId });
  view.inspect("external.file", { kind: "external-file", id: externalFileId });
};

export const renameExternalFile = (
  view: WorkspaceStateModel,
  row: Pick<LibraryExternalFileDetail, "id" | "revision">,
  name: string
) => view.singleFlight(
  ["external-file", view.project, row.id, "rename", row.revision, name.trim()],
  () => renameExternalFileRemote({
    externalFileId: row.id,
    baseRevision: row.revision,
    name: name.trim()
  }).updates(readExternalFileLibrary, readExternalFile({ externalFileId: row.id }))
);

export const removeExternalFile = (
  view: WorkspaceStateModel,
  row: Pick<LibraryExternalFileDetail, "id" | "revision">
) => view.singleFlight(
  ["external-file", view.project, row.id, "remove", row.revision],
  () => removeExternalFileRemote({
    externalFileId: row.id,
    baseRevision: row.revision
  }).updates(readExternalFileLibrary, readExternalFile({ externalFileId: row.id }))
);

export const refreshExternalFileSemantics = (
  view: WorkspaceStateModel,
  row: Pick<LibraryExternalFileDetail, "id" | "subkind">
) => view.singleFlight(
  ["external-file", view.project, row.id, "semantic-refresh"],
  async () => {
    const detail = readExternalFile({ externalFileId: row.id });
    const queued = await enqueueSemanticSync({
      ref: { kind: `externalFile::${row.subkind}`, id: row.id }
    }).updates(readExternalFileLibrary, detail);
    if (queued === null) return { supported: false as const };
    const processed = await processSemanticSyncQueue({
      limit: 2,
      ref: queued.ref
    }).updates(readExternalFileLibrary, detail);
    return { supported: true as const, processed };
  }
);

export const externalFileDownloadHref = (
  projectToken: string,
  externalFileId: string
): string => `/app/${encodeURIComponent(projectToken)}/external-files/${encodeURIComponent(externalFileId)}`;
