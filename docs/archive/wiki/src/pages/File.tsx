import { Link, useParams } from "react-router-dom";

import { Chip, Disclosure, FileLink, HomeChip, Page, Table } from "../components/common";
import { Markdown } from "../components/Prose";
import { Source } from "../components/Source";
import { checks, fileById, fileRoute, files, idOfRoute, testsExercising, units, TREE_ORDER, TREE_TITLES } from "../data";
import { NotFound } from "./NotFound";

const unitAnchor = (tree: string, unit: string | null): string | null => {
  if (!unit) return null;
  switch (tree) {
    case "capabilities":
      return `/trees/capabilities#${unit}`;
    case "model":
      return `/trees/model#${unit.replace("/", "-")}`;
    case "components":
      return unit.startsWith("authored/") ? `/trees/components#${unit.slice("authored/".length)}` : unit.startsWith("vendored/") ? `/trees/components#vendored-${unit.slice("vendored/".length)}` : "/trees/components#development";
    case "representation":
      return unit === "store" ? "/trees/representation#store" : `/trees/representation#domain-${unit.split("/")[1]}`;
    case "app-views":
      return unit.startsWith("categories/") ? `/trees/app-views#${unit.slice("categories/".length)}` : "/trees/app-views#general";
    case "surfaces":
    case "development-views":
      return `/trees/${tree}#${unit}`;
    case "runtime":
      return `/trees/runtime#root-${unit}`;
    case "styles":
      return "/design-system";
    default:
      return null;
  }
};

const documentBeside = (id: string): string | undefined => {
  const directory = id.slice(0, id.lastIndexOf("/"));
  const name = directory.slice(directory.lastIndexOf("/") + 1);
  const candidate = `${directory}/${name}.md`;
  return candidate !== id && fileById.has(candidate) ? candidate : undefined;
};

const checksNaming = (id: string) => checks.checks.filter((check) => check.source.includes(id.replace(/^app\/src\/lib\//, "").replace(/^app\/src\//, "")));

export const FilePage = () => {
  const params = useParams();
  const rest = params["*"] ?? "";
  const id = idOfRoute(rest);
  const entry = fileById.get(id);
  if (!entry) return <NotFound />;

  const siblings = files.filter((other) => other.id.slice(0, other.id.lastIndexOf("/")) === id.slice(0, id.lastIndexOf("/"))).sort((a, b) => a.name.localeCompare(b.name));
  const index = siblings.findIndex((other) => other.id === id);
  const previous = siblings[index - 1];
  const next = siblings[index + 1];
  const exercisedBy = testsExercising(id);
  const beside = documentBeside(id);
  const anchor = unitAnchor(entry.tree, entry.unit);
  const route = units.routes.find((candidate) => candidate.id === id);
  const named = checksNaming(id);
  const treeLabel = TREE_TITLES[entry.tree] ?? entry.tree;
  const browse = TREE_ORDER.includes(entry.tree) || ["routes", "root", "test"].includes(entry.tree) ? `/browse/${entry.tree}` : "/";

  return (
    <Page crumbs={[{ to: browse, label: treeLabel }, ...(entry.unit && anchor ? [{ to: anchor, label: entry.unit }] : [])]} title={entry.name}>
      <p className="path">{entry.id}</p>
      <div className="chips">
        <Chip>{entry.kind}</Chip>
        <Chip tone="active">{entry.role}</Chip>
        {entry.kind !== "document" && entry.kind !== "stylesheet" && entry.kind !== "html" && <HomeChip home={entry.home} />}
        <Chip>{entry.lines} lines</Chip>
        {entry.generated && <Chip tone="test">generated — do not edit</Chip>}
        {route && <Chip tone="server">route {route.route}</Chip>}
      </div>
      <p>
        {previous && (
          <>
            ← <FileLink id={previous.id} label={previous.name} />
          </>
        )}
        {previous && next && " · "}
        {next && (
          <>
            <FileLink id={next.id} label={next.name} /> →
          </>
        )}
        {beside && (
          <>
            {" "}
            · beside it: <FileLink id={beside} label={beside.split("/").pop()} />
          </>
        )}
      </p>

      {entry.blurb && (
        <>
          <h2 id="says">In its own words</h2>
          <Markdown text={entry.blurb} />
        </>
      )}

      {entry.kind === "document" && entry.text && (
        <>
          <h2 id="document">The document</h2>
          <p style={{ color: "var(--token-ink-muted)", fontSize: "var(--token-text-body-sm)" }}>
            Rendered as written. Relative links are not resolved; the paths it names are listed below and checked by the repository's own linter where a check reads them.
          </p>
          <Markdown text={entry.text} />
          {entry.namedPaths && entry.namedPaths.length > 0 && (
            <Disclosure summary={`${entry.namedPaths.length} paths named in this document`}>
              <ul className="section-list">
                {entry.namedPaths.map((named, position) => (
                  <li key={`${named.target}-${position}`}>
                    <code>{named.target}</code> <span style={{ color: "var(--token-ink-muted)" }}>line {named.line}</span>
                  </li>
                ))}
              </ul>
            </Disclosure>
          )}
        </>
      )}

      {(entry.kind === "stylesheet" || entry.kind === "html") && entry.text && (
        <>
          <h2 id="text">The file</h2>
          <pre>{entry.text}</pre>
        </>
      )}

      {entry.symbols.length > 0 && (
        <>
          <h2 id="symbols">Symbols</h2>
          <Table
            head={["name", "kind", "exported", "line"]}
            rows={entry.symbols.map((symbol) => [
              <span key="n" id={`symbol-${symbol.name}`}>
                <code>{symbol.name}</code>
                {symbol.from && (
                  <span style={{ color: "var(--token-ink-muted)" }}>
                    {" "}
                    from <code>{symbol.from}</code>
                  </span>
                )}
              </span>,
              symbol.kind,
              symbol.exported ? <Chip key="e" tone="shared">exported</Chip> : "",
              symbol.line
            ])}
          />
        </>
      )}

      {entry.exports.length > 0 && entry.symbols.length === 0 && (
        <>
          <h2 id="exports">Exports</h2>
          <p>{entry.exports.map((name) => <code key={name}>{name} </code>)}</p>
        </>
      )}

      {entry.tests && entry.tests.length > 0 && (
        <>
          <h2 id="tests">What it tests</h2>
          <ul className="section-list">
            {entry.tests.map((test, position) => (
              <li key={position}>
                <Chip>{test.kind}</Chip> {test.name}
                {test.template && <Chip tone="test">templated name</Chip>}
              </li>
            ))}
          </ul>
        </>
      )}

      <h2 id="imports">Imports</h2>
      {entry.imports.length === 0 ? (
        <p>Nothing.</p>
      ) : (
        <Table
          head={["specifier", "names", "resolves to"]}
          rows={entry.imports.map((record) => [
            <code key="s">{record.specifier}</code>,
            <span key="n" style={{ fontFamily: "var(--token-font-mono)", fontSize: "var(--token-text-caption)" }}>
              {record.type ? "type " : ""}
              {record.names.join(", ")}
            </span>,
            record.resolved ? <FileLink key="r" id={record.resolved} label={record.resolved.replace(/^app\//, "")} /> : record.provided ? <Chip key="p" tone="shared">provided by SvelteKit</Chip> : record.external ? <Chip key="e">{record.external}</Chip> : <Chip key="u" tone="danger">unresolved</Chip>
          ])}
        />
      )}

      <h2 id="imported-by">Imported by</h2>
      {entry.importedBy.length === 0 ? (
        <p>Nothing under app/src imports this file{entry.kind === "test" || entry.kind === "document" ? "" : route ? " — it is a route SvelteKit mounts" : entry.name.startsWith("index") ? "" : "."}</p>
      ) : (
        <ul className="section-list">
          {entry.importedBy.sort().map((importer) => (
            <li key={importer}>
              <FileLink id={importer} label={importer.replace(/^app\//, "")} /> <Chip>{fileById.get(importer)?.role}</Chip>
            </li>
          ))}
        </ul>
      )}

      {entry.kind !== "test" && entry.kind !== "document" && (
        <>
          <h2 id="exercised-by">Exercised by</h2>
          {exercisedBy.length === 0 ? (
            <p>
              No test file imports this file. <Link to="/tests#gaps">See the gaps.</Link>
            </p>
          ) : (
            <ul className="section-list">
              {exercisedBy.map((test) => (
                <li key={test.id}>
                  <FileLink id={test.id} label={test.id.replace(/^app\//, "")} /> <Chip tone="test">{test.kind}</Chip> · {test.names.length} tests
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {named.length > 0 && (
        <>
          <h2 id="checks">Named by checks</h2>
          <p>
            {named.map((check, position) => (
              <span key={check.name}>
                {position > 0 && ", "}
                <Link to={`/checks/${check.tree}/${check.name}`}>{check.name}</Link>
              </span>
            ))}
          </p>
        </>
      )}

      <h2 id="source">Source</h2>
      <Source app={entry.app} />
      <p style={{ marginTop: "calc(var(--token-spacing-unit) * 4)" }}>
        <Link to={fileRoute(id)}>Permalink</Link> · <Link to={browse}>Back to {treeLabel}</Link>
      </p>
    </Page>
  );
};
