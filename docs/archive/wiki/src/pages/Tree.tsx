import { Link, useParams } from "react-router-dom";

import representationMd from "../prose/trees/representation.md?raw";
import capabilitiesMd from "../prose/trees/capabilities.md?raw";
import modelMd from "../prose/trees/model.md?raw";
import runtimeMd from "../prose/trees/runtime.md?raw";
import componentsMd from "../prose/trees/components.md?raw";
import stylesMd from "../prose/trees/styles.md?raw";
import surfacesMd from "../prose/trees/surfaces.md?raw";
import appViewsMd from "../prose/trees/app-views.md?raw";
import developmentViewsMd from "../prose/trees/development-views.md?raw";

import { Chip, Disclosure, FileLink, Page, Says, Stat, Table } from "../components/common";
import { Markdown } from "../components/Prose";
import { Sections } from "../components/Sections";
import { checks, fileById, files, meta, tests, units, TREE_ORDER, TREE_TITLES } from "../data";
import { NotFound } from "./NotFound";

const PROSE: Record<string, string> = {
  representation: representationMd,
  capabilities: capabilitiesMd,
  model: modelMd,
  runtime: runtimeMd,
  components: componentsMd,
  styles: stylesMd,
  surfaces: surfacesMd,
  "app-views": appViewsMd,
  "development-views": developmentViewsMd
};

const LINT_TREES: Record<string, string[]> = {
  representation: ["representation"],
  capabilities: ["capabilities"],
  model: ["model"],
  runtime: ["runtime"],
  components: ["components"],
  styles: ["styles"],
  surfaces: ["surfaces"],
  "app-views": ["views", "surfaces"],
  "development-views": ["surfaces", "views"]
};

const short = (id: string, root: string): string => (id.startsWith(`${root}/`) ? id.slice(root.length + 1) : id.replace(/^app\/src\/lib\//, ""));

const Files = ({ ids, root }: { ids: string[]; root: string }) => (
  <>
    {ids.map((id, index) => (
      <span key={id}>
        {index > 0 && ", "}
        <FileLink id={id} label={short(id, root)} />
      </span>
    ))}
  </>
);

const RepresentationUnits = () => (
  <>
    <h3 id="domains">Domains</h3>
    <Table
      head={["domain", "may import", "type files", "behaviour files", "exported declarations"]}
      rows={units.domains.map((domain) => [
        <span key="n" id={`domain-${domain.name}`}>
          <code>{domain.name}</code>
        </span>,
        domain.declares.map((name) => <code key={name}>{name} </code>),
        <Files key="t" ids={domain.types} root={`app/src/lib/representation/data/types/${domain.name}`} />,
        <Files key="b" ids={domain.behavior} root={`app/src/lib/representation/data/behavior/${domain.name}`} />,
        domain.declarations.length
      ])}
    />
    <h3 id="store">Store</h3>
    <p>
      <FileLink id={units.tablesFile} /> declares {units.tables.length} tables — see <Link to="/data-model">Data model</Link>. Beside it: <FileLink id="app/src/lib/representation/store/path.ts" /> and <FileLink id="app/src/lib/representation/store/admission.ts" />.
    </p>
  </>
);

const CapabilityUnits = () => (
  <>
    {units.capabilities.map((capability) => (
      <div key={capability.name}>
        <h3 id={capability.name}>{capability.name}</h3>
        <p>
          {capability.document && (
            <>
              <FileLink id={capability.document} label={`${capability.name}.md`} /> ·{" "}
            </>
          )}
          {capability.index && <FileLink id={capability.index} label={capability.index.split("/").pop()} />}
        </p>
        <Table
          head={["export", "factory", "procedure", "files"]}
          rows={capability.procedures.map((procedure) => {
            const remote = capability.remote.find((entry) => entry.name.toLowerCase() === procedure.name.replace(/-/g, "").toLowerCase());
            return [remote ? <code key="e">{remote.name}</code> : "", remote ? <Chip key="f" tone={remote.factory === "command" ? "danger" : "client"}>{remote.factory}</Chip> : "", <FileLink key="p" id={procedure.entry} label={procedure.name} />, <Files key="s" ids={procedure.files.filter((id) => id !== procedure.entry)} root={`${capability.root}/api/${procedure.name}`} />];
          })}
        />
        {(capability.shared.length > 0 || capability.types.length > 0 || capability.constants.length > 0 || capability.tests.length > 0) && (
          <p>
            {capability.shared.length > 0 && (
              <>
                shared: <Files ids={capability.shared} root={`${capability.root}/api/shared`} /> ·{" "}
              </>
            )}
            {capability.types.length > 0 && (
              <>
                types: <Files ids={capability.types} root={`${capability.root}/types`} /> ·{" "}
              </>
            )}
            {capability.constants.length > 0 && (
              <>
                constants: <Files ids={capability.constants} root={`${capability.root}/constants`} /> ·{" "}
              </>
            )}
            tests: {capability.tests.length === 0 ? <Chip tone="danger">none</Chip> : <Files ids={capability.tests} root={`${capability.root}/test`} />}
          </p>
        )}
      </div>
    ))}
  </>
);

const ModelUnits = () => (
  <>
    {["client", "server"].map((environment) => (
      <div key={environment}>
        <h3 id={`${environment}-objects`}>{environment} objects</h3>
        {units.objects
          .filter((object) => object.environment === environment)
          .map((object) => (
            <div key={object.id} id={`${environment}-${object.name}`}>
              <h4>
                {object.name} {object.reactive && <Chip tone="active">runes</Chip>}
              </h4>
              <p>
                {object.document && (
                  <>
                    <FileLink id={object.document} label={`${object.name}.md`} /> ·{" "}
                  </>
                )}
                {object.index && <FileLink id={object.index} label={object.index.split("/").pop()} />} · {object.types && <FileLink id={object.types} label="types.ts" />} · {object.definition && <FileLink id={object.definition} label={object.definition.split("/").pop()} />} · {object.constructor && <FileLink id={object.constructor} label={object.constructors.join(", ") || "constructor.ts"} />}
              </p>
              <p>
                methods:{" "}
                {object.methods.length === 0 ? (
                  <Chip>none</Chip>
                ) : (
                  object.methods.map((method, index) => (
                    <span key={method.name}>
                      {index > 0 && ", "}
                      <FileLink id={method.file} label={method.shape === "directory" ? `${method.name}/` : method.name} />
                    </span>
                  ))
                )}
                {object.shared.filter((id) => !id.endsWith(".md")).length > 0 && (
                  <>
                    {" "}
                    · shared: <Files ids={object.shared.filter((id) => !id.endsWith(".md"))} root={`${object.root}/methods/shared`} />
                  </>
                )}
                {" "}· tests: {object.tests.length === 0 ? <Chip tone="danger">none</Chip> : <Files ids={object.tests} root={`${object.root}/test`} />}
              </p>
              {object.surface.length > 0 && (
                <p className="mono" style={{ color: "var(--token-ink-muted)", fontSize: "var(--token-text-caption)" }}>
                  types: {object.surface.map((type) => type.name).join(", ")}
                </p>
              )}
            </div>
          ))}
      </div>
    ))}
  </>
);

const RuntimeUnits = () => (
  <>
    {units.runtime.map((root) => (
      <div key={root.environment} id={`root-${root.environment}`}>
        <h3>{root.environment}</h3>
        <p>
          <FileLink id={root.start} /> · <FileLink id={root.types} />
        </p>
        <Table head={["#", "binding", "constructor", "takes"]} rows={root.constructions.map((construction, index) => [index + 1, <code key="b">{construction.name}</code>, <code key="c">{construction.callee}</code>, construction.takes.join(", ")])} />
        <Table head={["aggregate field", "type"]} rows={root.aggregateFields.map((field) => [<code key="n">{field.name}</code>, <code key="t">{field.type}</code>])} />
        <p>
          files: <Files ids={root.files} root={`app/src/lib/runtime/${root.environment}`} />
        </p>
      </div>
    ))}
  </>
);

const ComponentUnits = () => (
  <>
    <h3 id="authored">Authored vocabularies</h3>
    {units.vocabularies.map((vocabulary) => (
      <div key={vocabulary.name} id={vocabulary.name}>
        <h4>
          {vocabulary.name} <Chip>{vocabulary.files.filter((id) => id.endsWith(".svelte")).length} components</Chip>
        </h4>
        <p>
          {vocabulary.index && <FileLink id={vocabulary.index} label="index.ts" />} · {vocabulary.exports.filter((entry) => entry.component).map((entry) => entry.name).join(", ") || "no component exports"}
          {vocabulary.exports.some((entry) => !entry.component) && <> · helpers: {vocabulary.exports.filter((entry) => !entry.component).map((entry) => entry.name).join(", ")}</>}
        </p>
      </div>
    ))}
    <h3 id="vendored">Vendored parts</h3>
    <p>
      {units.vendored.map((part, index) => (
        <span key={part.name} id={`vendored-${part.name}`}>
          {index > 0 && ", "}
          {part.index ? <FileLink id={part.index} label={part.name} /> : part.name}
        </span>
      ))}
    </p>
    <h3 id="development">Development</h3>
    <p>
      <Files ids={units.developmentComponents} root="app/src/lib/components/development" />
    </p>
  </>
);

const StylesUnits = () => (
  <>
    <p>
      The whole tree is walked on the <Link to="/design-system">design system</Link> pages: <Link to="/design-system/themes">themes</Link>, <Link to="/design-system/slots">slots</Link>, <Link to="/design-system/tokens">tokens</Link>, <Link to="/design-system/integrations">integrations</Link>.
    </p>
    <Table head={["file", "stage", "declarations", "references"]} rows={filesOfStyles()} />
  </>
);

const filesOfStyles = () => files.filter((entry) => entry.tree === "styles" && entry.kind === "stylesheet").map((entry) => [<FileLink key="f" id={entry.id} label={short(entry.id, "app/src/lib/styles")} />, entry.role, entry.symbols.length, entry.importedBy.length]);

const SurfaceUnits = ({ development }: { development: boolean }) => (
  <>
    {units.surfaces
      .filter((surface) => surface.development === development)
      .map((surface) => (
        <div key={surface.name} id={surface.name}>
          <h3>{surface.name}</h3>
          <p>
            {surface.document && (
              <>
                <FileLink id={surface.document} label={`${surface.name}.md`} /> ·{" "}
              </>
            )}
            {surface.component && <FileLink id={surface.component} label={`${surface.name}.svelte`} />}
            {surface.types && (
              <>
                {" "}
                · <FileLink id={surface.types} label="types.ts" />
              </>
            )}
            {development && routesRendering(surface.component).length > 0 && <> · routes: {routesRendering(surface.component).map((route) => <code key={route}>{route} </code>)}</>}
          </p>
          {Object.entries(surface.concerns)
            .filter(([, ids]) => ids.filter((id) => !id.endsWith(".md")).length > 0)
            .map(([concern, ids]) => (
              <p key={concern}>
                {concern}: <Files ids={ids.filter((id) => !id.endsWith(".md"))} root={`${surface.root}/${concern}`} />
              </p>
            ))}
          {surface.tests.length > 0 && (
            <p>
              tests: <Files ids={surface.tests} root={`${surface.root}/test`} />
            </p>
          )}
        </div>
      ))}
  </>
);

const routesRendering = (component: string | null): string[] => (component ? units.routes.filter((route) => route.renders.includes(component)).map((route) => route.route) : []);

const ViewUnits = () => (
  <>
    <Table
      head={["category", "document", "content", "context", "inspector", "procedures", "tests"]}
      rows={units.categories.map((category) => [
        <span key="n" id={category.name}>
          <code>{category.name}</code>
        </span>,
        category.document ? <FileLink key="d" id={category.document} label={`${category.name}.md`} /> : <Chip key="d" tone="danger">none</Chip>,
        <Files key="c" ids={category.content.map((leaf) => leaf.file)} root={`${category.root}/content`} />,
        <Files key="x" ids={category.context.map((leaf) => leaf.file)} root={`${category.root}/context`} />,
        <Files key="i" ids={category.inspector.map((leaf) => leaf.file)} root={`${category.root}/inspector`} />,
        <Files key="p" ids={category.procedures} root={`${category.root}/procedures`} />,
        category.tests.length === 0 ? <Chip key="t">none</Chip> : <Files key="t" ids={category.tests} root={`${category.root}/procedures/test`} />
      ])}
    />
    <h3 id="general">General views</h3>
    {units.general.map((view) => (
      <p key={view.name}>
        <code>{view.name}</code>: <Files ids={view.files} root={view.root} />
      </p>
    ))}
    <p>
      The vocabulary those files make is on <Link to="/views">View vocabulary</Link>.
    </p>
  </>
);

export const TreePage = () => {
  const { tree = "" } = useParams();
  if (!TREE_ORDER.includes(tree)) return <NotFound />;
  const prose = PROSE[tree];
  const count = meta.counts[tree];
  const treeChecks = checks.checks.filter((check) => LINT_TREES[tree].includes(check.tree));
  const document = meta.treeDocuments[tree];
  const documentEntry = document ? fileById.get(document) : undefined;
  const treeTests = tests.filter((test) => test.tree === tree);
  const documents = files.filter((entry) => entry.tree === tree && entry.kind === "document");

  return (
    <Page crumbs={[{ to: "/", label: "Trees" }]} title={TREE_TITLES[tree]} lede={<code>app/src/lib/{tree}</code>}>
      <div className="stats">
        <Stat figure={count?.files ?? 0} label="files" to={`/browse/${tree}`} />
        {Object.entries(count?.kinds ?? {}).map(([kind, number]) => (
          <Stat key={kind} figure={number} label={kind === "test" ? "test files" : `${kind}s`} />
        ))}
        <Stat figure={treeChecks.length} label="checks apply" to={`/checks#${LINT_TREES[tree][0]}`} />
      </div>
      <p>
        <Link to={`/browse/${tree}`}>Browse every file →</Link>
        {documentEntry && (
          <>
            {" "}
            · tree document: <FileLink id={documentEntry.id} label={documentEntry.name} />
          </>
        )}
      </p>
      <Sections
        markdown={prose}
        after={{
          invariants: (
            <>
              {checks.order
                .filter((lintTree) => LINT_TREES[tree].includes(lintTree))
                .map((lintTree) => (
                  <div key={lintTree}>
                    <h3>{lintTree === tree ? "checks" : `${lintTree} checks`}</h3>
                    {treeChecks
                      .filter((check) => check.tree === lintTree)
                      .map((check) => (
                        <Says key={check.name} who={<Link to={`/checks/${check.tree}/${check.name}`}>{check.name}</Link>}>
                          {check.says}
                        </Says>
                      ))}
                  </div>
                ))}
              <p>
                The across checks — <Link to="/checks#across">client-server-separation, module-has-one-home, names-are-kebab-case, no-relative-imports, node-is-server-only, one-crossing</Link> — apply here as everywhere.
              </p>
            </>
          ),
          units: (
            <>
              {tree === "representation" && <RepresentationUnits />}
              {tree === "capabilities" && <CapabilityUnits />}
              {tree === "model" && <ModelUnits />}
              {tree === "runtime" && <RuntimeUnits />}
              {tree === "components" && <ComponentUnits />}
              {tree === "styles" && <StylesUnits />}
              {tree === "surfaces" && <SurfaceUnits development={false} />}
              {tree === "app-views" && <ViewUnits />}
              {tree === "development-views" && <SurfaceUnits development />}
              <h3 id="documents">Documents in this tree</h3>
              <p>
                {documents.length === 0 ? "none" : documents.map((entry, index) => (
                  <span key={entry.id}>
                    {index > 0 && ", "}
                    <FileLink id={entry.id} label={short(entry.id, `app/src/lib/${tree}`)} />
                  </span>
                ))}
              </p>
              <h3 id="tests">Tests in this tree</h3>
              <p>
                {treeTests.length === 0 ? <Chip tone="danger">no test files</Chip> : treeTests.map((test, index) => (
                  <span key={test.id}>
                    {index > 0 && ", "}
                    <FileLink id={test.id} label={short(test.id, `app/src/lib/${tree}`)} />
                  </span>
                ))}
              </p>
              {documentEntry?.text && (
                <Disclosure summary={`The tree's own document, ${documentEntry.name} — as written, not verified`}>
                  <Markdown text={documentEntry.text} />
                </Disclosure>
              )}
            </>
          )
        }}
      />
    </Page>
  );
};
