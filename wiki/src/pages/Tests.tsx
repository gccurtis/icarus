import { Link } from "react-router-dom";

import testsMd from "../prose/tests.md?raw";
import { Chip, Disclosure, FileLink, Page, Stat, Table } from "../components/common";
import { Sections } from "../components/Sections";
import { files, meta, tests, units, TREE_ORDER, TREE_TITLES } from "../data";

const SOURCE_KINDS = new Set(["module", "server module", "component", "reactive module", "remote index"]);

export const coverageByTree = () => {
  const exercised = new Set(tests.flatMap((test) => test.exercises));
  return [...TREE_ORDER, "routes", "root"].map((tree) => {
    const sources = files.filter((entry) => entry.tree === tree && SOURCE_KINDS.has(entry.kind));
    const covered = sources.filter((entry) => exercised.has(entry.id));
    const treeTests = tests.filter((test) => test.tree === tree);
    return { tree, sources, covered, uncovered: sources.filter((entry) => !exercised.has(entry.id)), treeTests, names: treeTests.reduce((sum, test) => sum + test.names.length, 0) };
  });
};

export const unitGaps = () => ({
  capabilities: units.capabilities.filter((capability) => capability.tests.length === 0).map((capability) => capability.name),
  objects: units.objects.filter((object) => object.tests.length === 0).map((object) => object.id),
  categories: units.categories.filter((category) => category.tests.length === 0).map((category) => category.name),
  surfaces: units.surfaces.filter((surface) => !surface.development && surface.tests.length === 0).map((surface) => surface.name),
  development: units.surfaces.filter((surface) => surface.development && surface.tests.length === 0).map((surface) => surface.name),
  vocabularies: units.vocabularies.filter((vocabulary) => !tests.some((test) => test.exercises.some((id) => id.startsWith(`${vocabulary.root}/`)))).map((vocabulary) => vocabulary.name)
});

export const Tests = () => {
  const coverage = coverageByTree();
  const gaps = unitGaps();
  const names = tests.reduce((sum, test) => sum + test.names.filter((name) => name.kind !== "describe").length, 0);
  const kinds = meta.testKinds.map((kind) => ({ kind, count: tests.filter((test) => test.kind === `${kind} test`).length }));
  return (
    <Page title="Tests" lede="Two suites, every test file mapped to what it imports, and the gaps named tree by tree.">
      <div className="stats">
        <Stat figure={tests.length} label="vitest files" />
        <Stat figure={names} label="test names" />
        {kinds.map((entry) => (
          <Stat key={entry.kind} figure={entry.count} label={`${entry.kind} files`} />
        ))}
      </div>
      <Sections
        markdown={testsMd}
        after={{
          "two-suites": (
            <Table
              head={["command", "runs", "over"]}
              rows={[
                [<code key="c">pnpm test</code>, <code key="r">{meta.packageScripts.test}</code>, "src/**/*.test.ts"],
                [<code key="c">pnpm test:scripts</code>, <code key="r">{meta.packageScripts["test:scripts"]}</code>, "scripts/test, scripts/generation/*/test"],
                [<code key="c">pnpm lint</code>, <code key="r">{meta.packageScripts.lint}</code>, "the 63 checks over src/"]
              ]}
            />
          ),
          "coverage-by-tree": (
            <>
              <Table
                head={["tree", "source modules", "imported by a test", "share", "test files", "test names"]}
                rows={coverage.map((row) => [
                  <Link key="t" to={TREE_ORDER.includes(row.tree) ? `/trees/${row.tree}` : `/browse/${row.tree}`}>
                    {TREE_TITLES[row.tree]}
                  </Link>,
                  row.sources.length,
                  row.covered.length,
                  row.sources.length === 0 ? "" : `${Math.round((row.covered.length / row.sources.length) * 100)}%`,
                  row.treeTests.length === 0 ? <Chip key="n" tone="danger">0</Chip> : row.treeTests.length,
                  row.names
                ])}
              />
              {coverage
                .filter((row) => row.treeTests.length > 0)
                .map((row) => (
                  <Disclosure key={row.tree} summary={`${TREE_TITLES[row.tree]} — ${row.treeTests.length} test files`}>
                    {row.treeTests.map((test) => (
                      <div key={test.id} style={{ marginBottom: "calc(var(--token-spacing-unit) * 3)" }}>
                        <FileLink id={test.id} label={test.id.replace(/^app\/src\//, "")} /> <Chip tone="test">{test.kind}</Chip> · {test.names.length} tests
                        <p style={{ margin: "calc(var(--token-spacing-unit) * 1) 0 0", color: "var(--token-ink-secondary)", fontSize: "var(--token-text-caption)" }}>
                          exercises:{" "}
                          {test.exercises.length === 0
                            ? "nothing under app/src"
                            : test.exercises.map((id, index) => (
                                <span key={id}>
                                  {index > 0 && ", "}
                                  <FileLink id={id} label={id.replace(/^app\/src\/lib\//, "").replace(/^app\/src\//, "")} />
                                </span>
                              ))}
                        </p>
                      </div>
                    ))}
                  </Disclosure>
                ))}
            </>
          ),
          gaps: (
            <>
              <ul className="gap-list">
                <li>
                  Capabilities with no tests: {gaps.capabilities.length === 0 ? "none" : gaps.capabilities.map((name) => <code key={name}>{name} </code>)}
                </li>
                <li>
                  Model objects with no tests: {gaps.objects.length === 0 ? "none" : gaps.objects.map((name) => <code key={name}>{name} </code>)}
                </li>
                <li>
                  Categories with no procedure tests: {gaps.categories.length === 0 ? "none" : gaps.categories.map((name) => <code key={name}>{name} </code>)}
                </li>
                <li>
                  Surfaces with no tests: {gaps.surfaces.length === 0 ? "none" : gaps.surfaces.map((name) => <code key={name}>{name} </code>)}
                </li>
                <li>
                  Development views with no tests: {gaps.development.length === 0 ? "none" : gaps.development.map((name) => <code key={name}>{name} </code>)}
                </li>
                <li>
                  Authored vocabularies no test imports: {gaps.vocabularies.length === 0 ? "none" : gaps.vocabularies.map((name) => <code key={name}>{name} </code>)}
                </li>
              </ul>
              {coverage
                .filter((row) => row.uncovered.length > 0)
                .map((row) => (
                  <Disclosure key={row.tree} summary={`${TREE_TITLES[row.tree]} — ${row.uncovered.length} source modules no test imports`}>
                    <ul className="section-list">
                      {row.uncovered.map((entry) => (
                        <li key={entry.id}>
                          <FileLink id={entry.id} label={entry.id.replace(/^app\/src\//, "")} /> <Chip>{entry.role}</Chip>
                        </li>
                      ))}
                    </ul>
                  </Disclosure>
                ))}
            </>
          )
        }}
      />
    </Page>
  );
};
