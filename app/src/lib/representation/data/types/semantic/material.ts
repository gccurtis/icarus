import type { ImageSource } from "$representation/data/types/content/content-block";
import type { Id, Row } from "$representation/data/types/core/id";
import type {
  ExternalFileResourceRef,
  ResourceRef
} from "$representation/data/types/core/resource";
import type { FileSubkind } from "$representation/data/types/external/file";

export type MaterialKind = "table" | "csv" | "chart" | "image" | "code";

export type NativeImageInput =
  | { kind: "url"; url: string }
  | { kind: "bytes"; base64: string; mediaType: string };

export type MaterialFacetKind =
  | "identity"
  | "profile"
  | "authored"
  | "generated"
  | "nativeVisual";

export type ContextualMaterialFacetKind = "authored" | "generated";
export type IntrinsicMaterialFacetKind = Exclude<
  MaterialFacetKind,
  ContextualMaterialFacetKind
>;

export type MaterialTrust = "exact" | "authored" | "interpreted" | "native";

export type MaterialState = "profiled" | "describing" | "ready" | "stale" | "error";

export type MaterialJobState = "queued" | "running" | "failed";

/** A stable path back to one material-bearing value in a represented resource. */
export type MaterialLocator =
  | {
      kind: "documentBlock";
      area: "body" | "header" | "firstPageHeader" | "footer" | "firstPageFooter";
      rowId: string;
      blockPath: string[];
    }
  | { kind: "slideElement"; slideId: string; elementPath: string[]; blockPath?: string[] }
  | { kind: "slideBackground"; slideId: string }
  | { kind: "spreadsheet"; rowIds: string[]; columnIds: string[] };

export type ResourceMaterialSource = {
  kind: "resourceContent";
  ref: ResourceRef;
  revision: number;
  locator: MaterialLocator;
};

export type ExternalFileMaterialSource = {
  kind: "externalFile";
  ref: ExternalFileResourceRef;
  fileId: Id<"externalFiles">;
  hash: string;
  mediaType: string;
  subkind: FileSubkind;
};

export type MaterialSource = ResourceMaterialSource | ExternalFileMaterialSource;

export type MaterialColumnProfile = {
  name: string;
  inferredType: "empty" | "boolean" | "number" | "date" | "text" | "mixed";
  nullCount: number;
  distinctCount?: number;
  minimum?: number;
  maximum?: number;
};

export type TableMaterialProfile = {
  kind: "table";
  rows: number;
  columns: number;
  headerRows: number;
  headers: string[];
  columnsProfile: MaterialColumnProfile[];
  mergedRegions: number;
  sample: string[][];
  warnings: string[];
};

export type CsvMaterialProfile = {
  kind: "csv";
  delimiter: string;
  encoding: "utf-8";
  rows: number;
  columns: number;
  headers: string[];
  columnsProfile: MaterialColumnProfile[];
  sample: string[][];
  sampledRows: number;
  malformedRows: number;
  truncated: boolean;
  warnings: string[];
};

export type ChartMaterialProfile = {
  kind: "chart";
  chartType: string;
  title?: string;
  axes: string[];
  series: string[];
  measures: string[];
  points: number;
  sourceHandles: string[];
  warnings: string[];
};

export type ImageMaterialProfile = {
  kind: "image";
  mediaType?: string;
  width?: number;
  height?: number;
  assetHash: string;
  alt?: string;
  caption?: string;
  source: ImageSource;
  placementCount: number;
  warnings: string[];
};

export type CodeSymbolProfile = {
  name: string;
  kind: "class" | "function" | "type" | "variable" | "export" | "unknown";
  fromLine: number;
  toLine: number;
};

export type CodeMaterialProfile = {
  kind: "code";
  language: string;
  lines: number;
  imports: string[];
  exports: string[];
  symbols: CodeSymbolProfile[];
  parser: "bounded-regex" | "unavailable";
  truncated: boolean;
  warnings: string[];
};

export type SpreadsheetMaterialProfile = TableMaterialProfile & {
  sheet: true;
};

export type MaterialProfile =
  | TableMaterialProfile
  | CsvMaterialProfile
  | ChartMaterialProfile
  | ImageMaterialProfile
  | CodeMaterialProfile
  | SpreadsheetMaterialProfile;

export type MaterialCoverage = {
  mode: "complete" | "sampled";
  description: string;
};

export type GeneratedMaterialDescriptor = {
  summary: string;
  purpose?: string;
  entities: string[];
  measures: string[];
  dimensions: string[];
  timeRange?: string;
  themes: string[];
  uncertainty: string[];
  coverage: MaterialCoverage;
  model: string;
  promptVersion: string;
  inputHash: string;
  generatedAt: number;
};

export type MaterialAuthoredContext = {
  title?: string;
  caption?: string;
  alt?: string;
  userDescription?: string;
  nearbyText: string[];
  notes: string[];
};

/** Pure inventory output. It contains bounded profile/context, never full native bytes. */
export type MaterialSeed = {
  identityKey: string;
  kind: MaterialKind;
  name: string;
  source: MaterialSource;
  placement?: { ref: ResourceRef; revision: number; locator: MaterialLocator };
  profile: MaterialProfile;
  context: MaterialAuthoredContext;
  userDescription?: string;
  /** Ephemeral provider input. Publication never stores base64 bytes. */
  nativeImage?: NativeImageInput;
};

export type SemanticMaterialFields = {
  projectId: Id<"projects">;
  identityKey: string;
  kind: MaterialKind;
  name: string;
  source: MaterialSource;
  profile: MaterialProfile;
  profileHash: string;
  /** Hash of the bounded authored context used to build semantic facets. */
  contextHash: string;
  revisionKey: string;
  userDescription?: string;
  descriptor?: GeneratedMaterialDescriptor;
  state: MaterialState;
  error?: string;
  updatedAt: number;
};

export type SemanticMaterial = Row<"semanticMaterials"> & SemanticMaterialFields;

export type SemanticMaterialPlacementFields = {
  projectId: Id<"projects">;
  semanticMaterialId: Id<"semanticMaterials">;
  ref: ResourceRef;
  revision: number;
  locator: MaterialLocator;
  context: MaterialAuthoredContext;
  contextHash: string;
  updatedAt: number;
};

export type SemanticMaterialJobFields = {
  projectId: Id<"projects">;
  ref: ResourceRef;
  requestedRevision: number;
  force?: boolean;
  state: MaterialJobState;
  attempts: number;
  error?: string;
  queuedAt: number;
  startedAt?: number;
  claimId?: string;
  leaseExpiresAt?: number;
  updatedAt: number;
};

export type SemanticMaterialSnapshot = {
  materialId: Id<"semanticMaterials">;
  kind: MaterialKind;
  name: string;
  source: MaterialSource;
  profileHash: string;
  contextHash: string;
  revisionKey: string;
};

export type SemanticMaterialHistoryFields = {
  projectId: Id<"projects">;
  retiredGeneration: number;
  material: SemanticMaterialFields;
  retiredAt: number;
};

type SemanticMaterialFacetBase = {
  trust: MaterialTrust;
  text?: string;
  inputHash: string;
};

export type SemanticMaterialFacet = SemanticMaterialFacetBase & (
  | {
      facet: ContextualMaterialFacetKind;
      text: string;
      /** Every resource whose authored context contributed to this aggregate facet. */
      scopeRefs: ResourceRef[];
    }
  | {
      facet: IntrinsicMaterialFacetKind;
      scopeRefs?: never;
    }
);

export type MaterialDescription =
  | { provenance: "authored"; text: string }
  | {
      provenance: "generated";
      text: string;
      model: string;
      promptVersion: string;
      coverage: MaterialCoverage;
    };

export type MaterialProfileDigest = {
  facts: string[];
  warnings: string[];
};

export type MaterialSourceSnapshot = SemanticMaterialSnapshot & {
  placement?: {
    ref: ResourceRef;
    revision: number;
    locator: MaterialLocator;
  };
};

export type MaterialHit = {
  semanticObjectIds: Id<"semanticObjects">[];
  evidenceKind: "interpreted";
  material: MaterialSourceSnapshot;
  profile: MaterialProfileDigest;
  /** Deterministic profile facet, retained even when only a native visual matched. */
  profileFacet: { inputHash: string; text: string };
  description?: MaterialDescription;
  matchedFacets: MaterialFacetKind[];
  matched: Array<{
    facet: MaterialFacetKind;
    inputHash: string;
    text?: string;
  }>;
  score: number;
  overlayGeneration: number;
};

export type MaterialNativeSelection =
  | { kind: "table"; rows: number[]; columns: number[] }
  | { kind: "csv"; rows: number[]; columns: string[] }
  | { kind: "chart"; series: string[] }
  | { kind: "image"; crop?: { x: number; y: number; width: number; height: number } }
  | { kind: "code"; fromLine: number; toLine: number };
