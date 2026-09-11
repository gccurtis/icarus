import ChartColumn from "@lucide/svelte/icons/chart-column";
import File from "@lucide/svelte/icons/file";
import FileText from "@lucide/svelte/icons/file-text";
import FlaskConical from "@lucide/svelte/icons/flask-conical";
import Lightbulb from "@lucide/svelte/icons/lightbulb";
import Presentation from "@lucide/svelte/icons/presentation";
import Sheet from "@lucide/svelte/icons/sheet";
import type { ResourceKind } from "$app-views/categories/project-overview/procedures/resources";

export const CREATE = [
  { key: "document", label: "Document", icon: FileText,
    tint: "border-interactive-border bg-interactive-surface text-interactive-text hover:border-interactive-fill hover:bg-interactive-surface-hover" },
  { key: "presentation", label: "Presentation", icon: Presentation,
    tint: "border-accent-1-border bg-accent-1-surface text-accent-1-text hover:border-accent-1-fill hover:bg-accent-1-surface-hover" },
  { key: "spreadsheet", label: "Spreadsheet", icon: Sheet,
    tint: "border-accent-2-border bg-accent-2-surface text-accent-2-text hover:border-accent-2-fill hover:bg-accent-2-surface-hover" },
  { key: "research", label: "Research chat", icon: FlaskConical,
    tint: "border-intelligence-border bg-intelligence-surface text-intelligence-text hover:border-intelligence-fill hover:bg-intelligence-surface-hover" },
  { key: "analysis", label: "Analysis graph", icon: ChartColumn,
    tint: "border-secondary-border bg-secondary-surface text-secondary-text hover:border-secondary-fill hover:bg-secondary-surface-hover" }
] as const;

export type CreateKind = (typeof CREATE)[number]["key"];

export const RESOURCE_ICON = {
  document: FileText, presentation: Presentation, spreadsheet: Sheet,
  research: FlaskConical, analysis: ChartColumn, file: File, finding: Lightbulb
} satisfies Record<ResourceKind, typeof FileText>;

export const RESOURCE_LABEL = {
  document: "Document", presentation: "Presentation", spreadsheet: "Spreadsheet",
  research: "Research chat", analysis: "Analysis graph", file: "External", finding: "Finding"
} satisfies Record<ResourceKind, string>;
