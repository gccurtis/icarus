import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import architecture from "../prose/architecture.md?raw";
import { Box, Diagram, Edge, FileLink, Page, Table } from "../components/common";
import { Sections } from "../components/Sections";
import { files, meta, units, TREE_ORDER, TREE_TITLES } from "../data";

const HOME_TONES: Record<string, string> = { client: "client", server: "server", shared: "shared", test: "test" };

const homeCounts = () => {
  const counts: Record<string, Record<string, number>> = {};
  for (const entry of files) {
    if (entry.kind === "document" || entry.kind === "stylesheet" || entry.kind === "html") continue;
    const home = entry.home ?? "none";
    counts[entry.tree] ??= {};
    counts[entry.tree][home] = (counts[entry.tree][home] ?? 0) + 1;
  }
  return counts;
};

const DirectionDiagram = () => {
  const width = 1180;
  const gap = 8;
  const boxWidth = (width - 40 - gap * (TREE_ORDER.length - 1)) / TREE_ORDER.length;
  const tones: Record<string, string> = { representation: "shared", capabilities: "server", model: "plain", runtime: "plain", components: "client", styles: "plain", surfaces: "client", "app-views": "client", "development-views": "attention" };
  return (
    <Diagram viewBox={`0 0 ${width} 170`} caption="Dependency runs left to right: a tree may import the trees before it and never the ones after. Representation imports nothing; development views may import anything and are imported by nothing.">
      {TREE_ORDER.map((tree, index) => (
        <Box key={tree} x={20 + index * (boxWidth + gap)} y={40} w={boxWidth} h={56} tone={tones[tree]} title={tree} lines={[`${meta.counts[tree]?.files ?? 0} files`]} />
      ))}
      <Edge d={`M 30 120 L ${width - 30} 120`} tone="strong" />
      <text x={width / 2} y={145} textAnchor="middle" className="muted">
        may import ⟶ · the across checks (one home, one crossing, no relative imports, kebab-case) apply to every tree
      </text>
    </Diagram>
  );
};

const CrossingDiagram = () => (
  <Diagram viewBox="0 0 1180 250" caption="The one crossing: a view imports a capability's index.remote.ts; SvelteKit serves the same export as a fetch; on the server it is the procedure, gated by requireScope and then validated.">
    <Box x={20} y={30} w={230} h={80} tone="client" title="view or model method" lines={["app-views/…", "model/client/…/flush.ts"]} mono />
    <Box x={330} y={30} w={260} h={80} tone="client" title="index.remote.ts" lines={["export const submitDocumentChanges =", "command(\"unchecked\", procedure)"]} mono />
    <Box x={680} y={30} w={200} h={80} tone="plain" title="fetch" lines={["/_app/remote/…", "x-sveltekit-pathname"]} mono />
    <Box x={950} y={30} w={210} h={80} tone="server" title="procedure" lines={["requireScope()", "validate…(input)"]} mono />
    <Edge d="M 250 70 L 328 70" tone="strong" />
    <Edge d="M 590 70 L 678 70" tone="strong" />
    <Edge d="M 880 70 L 948 70" tone="strong" />
    <Box x={950} y={150} w={210} h={70} tone="server" title="scope.server.ts" lines={["session from cookie (hooks)", "project token from pathname"]} />
    <Edge d="M 1055 110 L 1055 148" dashed />
    <Box x={330} y={150} w={260} h={70} tone="server" title="serverModel().store" lines={["capability reaches the store only", "through the model object"]} />
    <Edge d="M 950 185 L 592 185" dashed />
    <text x={20} y={240} className="muted">
      browser · one-crossing, no-procedure-acts-outside-a-scope, procedure-validates-first, storage-through-a-model
    </text>
  </Diagram>
);

export const Architecture = () => {
  const counts = homeCounts();
  const homes = ["client", "server", "shared", "test", "none"];
  return (
    <Page title="Architecture" lede="Nine trees in one direction, two processes with one home per module, one crossing between them, and two composition roots.">
      <Sections
        markdown={architecture}
        after={{
          "the-direction-of-dependency": <DirectionDiagram />,
          "two-processes-one-home-per-module": (
            <Table
              head={["tree", ...homes.map((home) => <span key={home} className={`chip ${HOME_TONES[home] ?? ""}`}>{home}</span>)]}
              rows={[...TREE_ORDER, "routes", "root", "test"].map((tree) => [<Link key={tree} to={tree === "routes" || tree === "root" || tree === "test" ? `/browse/${tree}` : `/trees/${tree}`}>{TREE_TITLES[tree]}</Link>, ...homes.map((home) => counts[tree]?.[home] ?? "")])}
            />
          ),
          "the-one-crossing": <CrossingDiagram />,
          "two-composition-roots": (
            <div className="two-column">
              {units.runtime.map((root) => (
                <div key={root.environment}>
                  <h3 id={`root-${root.environment}`}>{root.environment}</h3>
                  <p>
                    <FileLink id={root.start} /> · builder <code>{root.builder}</code> · initializer <code>{root.initializer}</code> · accessor <code>{root.accessor}</code>
                    {root.closer && (
                      <>
                        {" "}
                        · closer <code>{root.closer}</code>
                      </>
                    )}
                  </p>
                  <Table head={["#", "binding", "constructed by", "takes"]} rows={root.constructions.map((construction, index) => [index + 1, <code key="n">{construction.name}</code>, <code key="c">{construction.callee}</code>, construction.takes.map((taken) => <code key={taken}>{taken} </code>)])} />
                  <p>
                    Returned as <code>{root.aggregate}</code>: {root.returned.map((field) => <code key={field}>{field} </code>)}
                  </p>
                </div>
              ))}
            </div>
          ),
          routes: (
            <Table
              head={["route", "file", "role", "renders"]}
              rows={units.routes.map((route) => [<code key="r">{route.route}</code>, <FileLink key="f" id={route.id} label={route.name} />, route.role, route.renders.map((id) => <FileLink key={id} id={id} label={id.replace(/^app\/src\/lib\//, "").replace(/^app\/src\//, "")} />).reduce<ReactNode[]>((held, node, index) => (index === 0 ? [node] : [...held, ", ", node]), [])])}
            />
          ),
          aliases: <Table head={["alias", "target"]} rows={Object.entries(meta.aliases).map(([alias, target]) => [<code key="a">{alias}</code>, <code key="t">{target}</code>])} />,
          "third-party-packages": (
            <div className="two-column">
              <Table head={["dependency", "version"]} rows={Object.entries(meta.dependencies).map(([name, version]) => [<code key="n">{name}</code>, version])} />
              <Table head={["dev dependency", "version"]} rows={Object.entries(meta.devDependencies).map(([name, version]) => [<code key="n">{name}</code>, version])} />
            </div>
          )
        }}
      />
    </Page>
  );
};
