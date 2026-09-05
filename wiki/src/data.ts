import filesJson from "./data/files.json";
import unitsJson from "./data/units.json";
import vocabularyJson from "./data/vocabulary.json";
import stylesJson from "./data/styles.json";
import checksJson from "./data/checks.json";
import generatorsJson from "./data/generators.json";
import testsJson from "./data/tests.json";
import configurationJson from "./data/configuration.json";
import metaJson from "./data/meta.json";

export type ImportRecord = {
  specifier: string;
  line: number;
  names: string[];
  type: boolean;
  resolved: string | null;
  external: string | null;
  provided: boolean;
};

export type Symbol = {
  name: string;
  kind: string;
  exported: boolean;
  from?: string;
  line: number;
};

export type FileEntry = {
  id: string;
  app: string;
  name: string;
  tree: string;
  unit: string | null;
  kind: string;
  role: string;
  home: string | null;
  lines: number;
  bytes: number;
  imports: ImportRecord[];
  importedBy: string[];
  exports: string[];
  symbols: Symbol[];
  blurb: string;
  generated: boolean;
  headings: { depth: number; text: string }[];
  text?: string;
  route?: string;
  tests?: { kind: string; name: string; template: boolean }[];
  namedPaths?: { target: string; line: number }[];
};

export type Procedure = { name: string; entry: string; files: string[] };
export type CapabilityUnit = {
  name: string;
  root: string;
  document: string | null;
  index: string | null;
  remote: { name: string; factory: string }[];
  procedures: Procedure[];
  shared: string[];
  types: string[];
  constants: string[];
  tests: string[];
  files: string[];
};

export type MethodEntry = { name: string; file: string; shape: string; files?: string[] };
export type ObjectUnit = {
  id: string;
  name: string;
  environment: string;
  root: string;
  document: string | null;
  index: string | null;
  types: string | null;
  definition: string | null;
  reactive: boolean;
  constructor: string | null;
  constructors: string[];
  methods: MethodEntry[];
  shared: string[];
  methodsDocument: string | null;
  sharedDocument: string | null;
  tests: string[];
  surface: { name: string; kind: string; exported: boolean; text?: string; members?: { name: string; optional: boolean; type: string; method?: boolean }[]; line: number }[];
  files: string[];
};

export type RuntimeRoot = {
  environment: string;
  start: string;
  types: string;
  builder: string;
  initializer: string;
  accessor: string;
  closer: string | null;
  aggregate: string;
  aggregateFields: { name: string; optional: boolean; type: string; method?: boolean }[];
  constructions: { name: string; callee: string; takes: string[]; line: number }[];
  returned: string[];
  files: string[];
};

export type VocabularyUnit = {
  name: string;
  root: string;
  index: string | null;
  exports: { name: string; from: string; component: boolean; type?: boolean }[];
  blurb: string;
  files: string[];
};

export type VendoredUnit = { name: string; root: string; index: string | null; files: string[]; exports: string[] };

export type DomainUnit = {
  name: string;
  declares: string[];
  types: string[];
  behavior: string[];
  declarations: { name: string; kind: string; exported: boolean; text?: string; members?: { name: string; optional: boolean; type: string }[]; line: number; file: string }[];
};

export type TableUnit = {
  name: string;
  fieldsType: string | null;
  rowType: string | null;
  fields: { name: string; optional: boolean; type: string }[];
};

export type SurfaceUnit = {
  name: string;
  development: boolean;
  root: string;
  document: string | null;
  component: string | null;
  types: string | null;
  concerns: Record<string, string[]>;
  tests: string[];
  files: string[];
};

export type CategoryUnit = {
  name: string;
  root: string;
  document: string | null;
  content: { key: string; file: string }[];
  context: { key: string; file: string }[];
  inspector: { key: string; file: string }[];
  procedures: string[];
  tests: string[];
  files: string[];
};

export type GeneralUnit = { name: string; root: string; component: string | null; files: string[] };
export type RouteUnit = { id: string; route: string; role: string; name: string; renders: string[] };

export type Units = {
  capabilities: CapabilityUnit[];
  objects: ObjectUnit[];
  runtime: RuntimeRoot[];
  vocabularies: VocabularyUnit[];
  vendored: VendoredUnit[];
  developmentComponents: string[];
  domains: DomainUnit[];
  tables: TableUnit[];
  tablesFile: string;
  surfaces: SurfaceUnit[];
  categories: CategoryUnit[];
  general: GeneralUnit[];
  routes: RouteUnit[];
};

export type Opening = { content?: string; context: string | null; rail: string[] };

export type Vocabulary = {
  categories: { key: string; singleton: boolean; opening: Opening | null }[];
  contentViews: { key: string; file: string | null }[];
  contextViews: { key: string; file: string | null; onRail: boolean; label: string | null; icon: string | null }[];
  inspectorViews: { key: string; file: string | null }[];
  keysFile: string;
  viewKeysFile: string;
  opening: Record<string, Opening>;
  startingFrame: Record<string, number | boolean>;
  singletons: string[];
  commandIds: string[];
  defaultBindings: Record<string, string>;
  publishedKeys: string[];
  categoryEntries: Record<string, string>;
  themes: string[];
  seriesColors: string[];
  translationConfiguration: { name: string; optional: boolean; type: string }[];
};

export type Declaration = { name: string; value: string; selectors?: string[]; line?: number };
export type ThemeUnit = {
  name: string;
  root: string;
  css: string;
  document: string | null;
  scheme: string | null;
  bindsRoot: boolean;
  palette: Record<string, Record<string, string>>;
  themeTokens: { name: string; value: string }[];
};
export type Styles = {
  entry: string;
  entryImports: { target: string; relative: boolean; line: number }[];
  stages: string[];
  tokenFiles: string[];
  roles: { meaning: Record<string, string>; identity: Record<string, string>; brand: Record<string, string>; all: Record<string, string> };
  slots: string[];
  themes: ThemeUnit[];
  slotTable: { name: string; value: string }[];
  tokens: { domain: string; id: string; declarations: Declaration[] }[];
  integrations: { name: string; root: string; document: string | null; files: string[]; declarations: (Declaration & { file: string })[] }[];
  sheets: { id: string; stage: string | null; generated: boolean; declarations: Declaration[]; references: { name: string; prop: string; line: number }[]; imports: { target: string; relative: boolean; line: number }[] }[];
};

export type Check = {
  tree: string;
  name: string;
  says: string;
  subjects: Record<string, string>;
  file: string;
  source: string;
  blurb: string;
};
export type Mutation = {
  check: string;
  tree: string | null;
  subject: string | null;
  says: string;
  names: string;
  changes: { path: string; write: string | null; edit: boolean; remove: boolean }[];
};
export type Checks = { checks: Check[]; mutations: Mutation[]; shared: { id: string; name: string; blurb: string; symbols: string[] }[]; order: string[] };

export type Generator = { id: string; group: string; name: string; command: string | null; usage: string[]; description: string[]; shared: boolean };
export type Generators = {
  generators: Generator[];
  scriptTests: { id: string; name: string; test: boolean; blurb: string; tests: { kind: string; name: string }[] }[];
  otherScripts: { id: string; name: string; blurb: string; usage: string[] }[];
};

export type TestFile = { id: string; tree: string; unit: string | null; kind: string; names: { kind: string; name: string; template: boolean }[]; exercises: string[]; mocks: string };
export type ConfigurationFile = { id: string; name: string; text: string; value: unknown };
export type Meta = {
  extractedAt: string;
  totalFiles: number;
  counts: Record<string, { files: number; kinds: Record<string, number> }>;
  trees: string[];
  treeDocuments: Record<string, string | null>;
  aliases: Record<string, string>;
  lintOrder: string[];
  environments: string[];
  testKinds: string[];
  concerns: string[];
  viewSurfaces: string[];
  viewTrees: string[];
  packageScripts: Record<string, string>;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  seedTables: string[];
  configurationReadme: string;
};

export const files = filesJson as unknown as FileEntry[];
export const units = unitsJson as unknown as Units;
export const vocabulary = vocabularyJson as unknown as Vocabulary;
export const styles = stylesJson as unknown as Styles;
export const checks = checksJson as unknown as Checks;
export const generators = generatorsJson as unknown as Generators;
export const tests = testsJson as unknown as TestFile[];
export const configuration = configurationJson as unknown as ConfigurationFile[];
export const meta = metaJson as unknown as Meta;

export const fileById = new Map(files.map((entry) => [entry.id, entry]));
export const fileByApp = new Map(files.map((entry) => [entry.app, entry]));

export const filesInTree = (tree: string): FileEntry[] => files.filter((entry) => entry.tree === tree);

export const fileRoute = (id: string): string => `/files/${id.replace(/^app\//, "")}`;

export const idOfRoute = (rest: string): string => `app/${rest}`;

export const checkByName = new Map(checks.checks.map((check) => [`${check.tree}/${check.name}`, check]));
export const checkRoute = (check: Check): string => `/checks/${check.tree}/${check.name}`;

export const findCheck = (name: string): Check[] => checks.checks.filter((check) => check.name === name);

export const treeRoute = (tree: string): string => `/trees/${tree}`;

export const testsExercising = (id: string): TestFile[] => tests.filter((test) => test.exercises.includes(id));

export const tokenNames = new Set(styles.tokens.flatMap((domain) => domain.declarations.map((declaration) => declaration.name)));

export const allSymbols = new Map<string, string[]>();
for (const entry of files) {
  for (const symbol of entry.symbols) {
    const held = allSymbols.get(symbol.name) ?? [];
    held.push(entry.id);
    allSymbols.set(symbol.name, held);
  }
}

export const TREE_ORDER = ["representation", "capabilities", "model", "runtime", "components", "styles", "surfaces", "app-views", "development-views"];

export const TREE_TITLES: Record<string, string> = {
  representation: "Representation",
  capabilities: "Capabilities",
  model: "Model",
  runtime: "Runtime",
  components: "Components",
  styles: "Styles",
  surfaces: "Surfaces",
  "app-views": "App views",
  "development-views": "Development views",
  routes: "Routes",
  test: "Route-wide tests",
  root: "Root files"
};

export const homeLabel = (home: string | null): string => home ?? "none";
