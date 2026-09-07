export type SurfaceTrack = { readonly id: string; readonly label: string; readonly size: number };

export type SurfaceTone = "plain" | "formula" | "pending" | "error" | "spill";

export type SurfaceAlign = "left" | "center" | "right";

export type SurfaceValign = "top" | "middle" | "bottom";

export type SurfaceRun = {
  readonly text: string;
  readonly bold: boolean;
  readonly italic: boolean;
  readonly underline: boolean;
  readonly strike: boolean;
  readonly code: boolean;
  readonly color?: string;
};

export type SurfacePin = { readonly count: number; readonly state: "open" | "current" | "detached" };

export type SurfaceBorderSide = "top" | "right" | "bottom" | "left";

export type SurfaceBorderLine = {
  readonly color: string;
  readonly width: number;
  readonly style: "solid" | "dashed" | "dotted";
};

export type SurfaceBorder = { readonly [side in SurfaceBorderSide]?: SurfaceBorderLine };

export type SurfaceCell = {
  readonly text: string;
  readonly raw: string;
  readonly tone: SurfaceTone;
  readonly align: SurfaceAlign;
  readonly valign: SurfaceValign;
  readonly spilled: boolean;
  readonly weight: number;
  readonly italic: boolean;
  readonly underline: boolean;
  readonly strike: boolean;
  readonly mono: boolean;
  readonly size?: number;
  readonly font?: string;
  readonly color?: string;
  readonly background?: string;
  readonly span?: number;
  readonly spanFrom?: number;
  readonly covered: boolean;
  readonly readonly: boolean;
  readonly runs?: readonly SurfaceRun[];
  readonly pin?: SurfacePin;
  readonly border?: SurfaceBorder;
};

export type SurfaceScene = {
  readonly columns: readonly SurfaceTrack[];
  readonly rows: readonly SurfaceTrack[];
  readonly frozenColumns: number;
  /** How many rows the grid pins, counted from the last one. */
  readonly frozenRows: number;
  readonly cellAt: (row: number, column: number) => SurfaceCell;
};

export type SurfaceRect = {
  readonly row: number;
  readonly column: number;
  readonly rows: number;
  readonly columns: number;
};

export type SurfaceSelection = {
  readonly cell?: readonly [column: number, row: number];
  readonly ranges: readonly SurfaceRect[];
  readonly rows: readonly number[];
  readonly columns: readonly number[];
};

export type SurfaceHighlightTone = "reads" | "feeds" | "hit" | "current" | "spill" | "selected";

export type SurfaceHighlight = { readonly rect: SurfaceRect; readonly tone: SurfaceHighlightTone };

export type SurfaceEdit = { readonly row: number; readonly column: number; readonly text: string };

export type SurfaceFill = { readonly source: SurfaceRect; readonly target: SurfaceRect };

export type SurfacePaste = {
  readonly row: number;
  readonly column: number;
  readonly values: readonly (readonly string[])[];
};

export type SurfaceDirection = "up" | "down" | "left" | "right";

export type SurfaceHit =
  | { readonly kind: "cell"; readonly row: number; readonly column: number }
  | { readonly kind: "row"; readonly row: number }
  | { readonly kind: "column"; readonly column: number }
  | { readonly kind: "corner" };

export type SurfaceApi = {
  readonly copy: () => void;
  readonly cut: () => void;
  readonly paste: () => void;
  readonly focus: () => void;
};
