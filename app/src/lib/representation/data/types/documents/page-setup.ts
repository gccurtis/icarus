export type PaperSize =
  | "letter"
  | "legal"
  | "tabloid"
  | "a3"
  | "a4"
  | "a5"
  | { width: number; height: number };

export type Orientation = "portrait" | "landscape";

export type Margins = { top: number; right: number; bottom: number; left: number };

export type PageSetup = { paper: PaperSize; orientation: Orientation; margins: Margins };
