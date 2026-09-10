import Braces from "@lucide/svelte/icons/braces";
import ClockArrowLeft from "@lucide/svelte/icons/clock-arrow-left";
import FileImage from "@lucide/svelte/icons/file-image";
import FileText from "@lucide/svelte/icons/file-text";
import Info from "@lucide/svelte/icons/info";
import Table2 from "@lucide/svelte/icons/table-2";

export type MockContextView = "overview" | "history";
export type MockLibraryView = "table" | "directory";
export type MockSemanticFilter = "all" | "current" | "queued" | "limited";
export type MockEditField = "name" | "path";

export const MOCK_EXTERNAL_FILES = [
  {
    id: "externalFiles:quarterly-revenue",
    originalName: "quarterly-revenue.csv",
    path: "imports/finance/quarterly-revenue.csv",
    media: "text/csv",
    type: "CSV",
    size: "84.2 KB",
    uploaded: "Sep 9, 2026 at 10:14 AM",
    updated: "12 min ago",
    semantic: "Summary ready",
    semanticTone: "current" as const,
    semanticMode: "descriptor" as const,
    summary: "This dataset compares quarterly revenue, plan, and year-over-year change across four operating regions. West contributes the largest reported total and the strongest growth; South is the only region below plan. Treat currency-looking columns as USD unless the authored dataset context says otherwise.",
    profile: "5 parsed rows · 4 columns · region, revenue, plan, yoy_change",
    context: "Quarterly operating review exported from Finance. Currency columns are USD.",
    references: ["Q3 filing", "Operating review"],
    icon: Table2
  },
  {
    id: "externalFiles:pricing-engine",
    originalName: "pricing-engine.ts",
    path: "imports/source/pricing-engine.ts",
    media: "text/typescript",
    type: "TypeScript",
    size: "12.8 KB",
    uploaded: "Sep 9, 2026 at 9:48 AM",
    updated: "38 min ago",
    semantic: "Summary ready",
    semanticTone: "current" as const,
    semanticMode: "descriptor" as const,
    summary: "Pricing utilities calculate plan rates, apply seat-volume discounts, and round the resulting currency amount. The profile identifies six exported symbols and three internal helpers; it describes syntax only and does not execute the module.",
    profile: "TypeScript · 214 lines · 3 imports · 6 exported symbols",
    context: "",
    references: ["Pricing proposal"],
    icon: Braces
  },
  {
    id: "externalFiles:vendor-contract",
    originalName: "vendor-contract.pdf",
    path: "legal/vendors/vendor-contract.pdf",
    media: "application/pdf",
    type: "PDF",
    size: "2.4 MB",
    uploaded: "Sep 8, 2026 at 3:20 PM",
    updated: "Yesterday",
    semantic: "Managed only",
    semanticTone: "limited" as const,
    semanticMode: "none" as const,
    summary: "",
    profile: "",
    context: "",
    references: [],
    icon: FileText
  },
  {
    id: "externalFiles:station-installation",
    originalName: "station-installation.png",
    path: "research/site/station-installation.png",
    media: "image/png",
    type: "Image",
    size: "1.7 MB",
    uploaded: "Sep 7, 2026 at 1:03 PM",
    updated: "2 days ago",
    semantic: "Visual ready",
    semanticTone: "current" as const,
    semanticMode: "visual" as const,
    summary: "",
    profile: "Original image embedded directly · no generated text summary",
    context: "",
    references: ["Site report", "Installation brief"],
    icon: FileImage
  }
] as const;

export type MockExternalFile = (typeof MOCK_EXTERNAL_FILES)[number];

export const MOCK_CONTEXTS = [
  { id: "overview" as const, label: "Overview", icon: Info },
  { id: "history" as const, label: "History", icon: ClockArrowLeft }
] as const;

export const INITIAL_MOCK_HISTORY = [
  "Uploaded quarterly-revenue.csv · 12 min ago",
  "Re-uploaded pricing-engine.ts · 38 min ago",
  "Moved station-installation.png · 2 days ago"
];
