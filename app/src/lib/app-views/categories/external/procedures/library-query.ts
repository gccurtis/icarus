import type {
  ExternalDirectoryItem,
  ExternalFileDetail,
  ExternalFileHistoryEntry,
  ExternalFileLibraryItem,
  ReadExternalFileLibraryResult
} from "$capabilities/external-files/index.remote";
import { updatedTime } from "$app-views/categories/external/procedures/updated-time";

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

export type LibraryExternalDirectory = ExternalDirectoryItem & { readonly sizeLabel: string };
export type LibraryExternalHistoryEntry = ExternalFileHistoryEntry & { readonly when: string };

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
  return new Date(at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

export const bytesLabel = (value: number): string => {
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
  if (states.includes("current")) return {
    semanticLabel: row.semantic.exact.state === "current" ? "Search ready" : "Profile ready",
    semanticTone: "current"
  };
  if (states.every((state) => state === "unsupported")) {
    return { semanticLabel: "Managed only", semanticTone: "limited" };
  }
  return { semanticLabel: "Not processed", semanticTone: "idle" };
};

const project = (row: ExternalFileLibraryItem, now: number): LibraryExternalFile => ({
  ...row,
  updated: updatedTime(row.updatedAt, now),
  sizeLabel: bytesLabel(row.size),
  ...semanticPresentation(row)
});

export const externalFilesIn = (
  answer: ReadExternalFileLibraryResult | undefined,
  now: number
): readonly LibraryExternalFile[] => answer?.files.map((row) => project(row, now)) ?? [];

export const externalDirectoriesIn = (
  answer: ReadExternalFileLibraryResult | undefined
): readonly LibraryExternalDirectory[] => answer?.directories.map((directory) => ({
  ...directory,
  sizeLabel: bytesLabel(directory.knownBytes)
})) ?? [];

export const externalHistoryIn = (
  entries: readonly ExternalFileHistoryEntry[] | undefined,
  now: number
): readonly LibraryExternalHistoryEntry[] => entries?.map((entry) => ({
  ...entry,
  when: relativeTime(entry.at, now)
})) ?? [];

export const presentExternalFile = project;
