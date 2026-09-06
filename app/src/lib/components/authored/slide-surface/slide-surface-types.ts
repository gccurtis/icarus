export type SurfaceFrame = { readonly x: number; readonly y: number; readonly width: number; readonly height: number };

export type SurfacePoint = { readonly x: number; readonly y: number };

export type SurfaceRun = {
  readonly text: string;
  readonly bold: boolean;
  readonly italic: boolean;
  readonly underline: boolean;
  readonly strike: boolean;
  readonly code: boolean;
  readonly color?: string;
  readonly formula: boolean;
};

export type SurfaceText = {
  readonly blockId: string;
  readonly display: string;
  readonly runs: readonly SurfaceRun[];
  readonly font: string;
  readonly size: number;
  readonly weight: number;
  readonly italic: boolean;
  readonly underline: boolean;
  readonly color: string;
  readonly lineHeight: number;
  readonly align: "start" | "center" | "end" | "justify";
  readonly valign: "top" | "middle" | "bottom";
  readonly spaceBefore: number;
  readonly spaceAfter: number;
  readonly indent: number;
  readonly padding: number;
};

export type SurfaceCell = {
  readonly id: string;
  readonly text?: SurfaceText;
  readonly row: number;
  readonly column: number;
  readonly rowSpan: number;
  readonly columnSpan: number;
  readonly fill?: string;
  readonly border?: { readonly color: string; readonly width: number; readonly style: string };
  readonly header: boolean;
};

export type SurfaceItem = {
  readonly id: string;
  readonly type: string;
  readonly frame: SurfaceFrame;
  readonly rotation: number;
  readonly depth: number;
  readonly parents: readonly string[];
  readonly locked: boolean;
  readonly fixed: boolean;
  readonly overflow: "clip" | "shrink" | "grow";
  readonly fill?: string;
  readonly stroke?: string;
  readonly strokeWidth: number;
  readonly dash: string;
  readonly opacity: number;
  readonly radius: number;
  readonly shadow?: string;
  readonly shape?: string;
  readonly text?: SurfaceText;
  readonly line?: { from: SurfacePoint; to: SurfacePoint; start: string; end: string };
  readonly image?: { src?: string; alt: string };
  readonly table?: {
    rows: readonly (readonly SurfaceCell[])[];
    columns: number;
    headerRows: number;
    columnWidths?: readonly number[];
    rowHeights?: readonly number[];
  };
  readonly children: number;
};

export type SurfaceScene = {
  readonly ratio: string;
  readonly units: { readonly width: number; readonly height: number };
  readonly background: string;
  readonly items: readonly SurfaceItem[];
};

export type SurfaceGuide = { readonly axis: "x" | "y"; readonly at: number; readonly label: string };

export type SurfaceMove = { readonly id: string; readonly frame: SurfaceFrame };

export type SurfaceBadge = { readonly id: string; readonly count: number };

export type SurfaceTextEdit = {
  readonly blockId: string;
  readonly from: number;
  readonly to: number;
  readonly insert: string;
};
