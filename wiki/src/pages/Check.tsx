import { Link, useParams } from "react-router-dom";

import checksMd from "../prose/checks.md?raw";
import { Callout, Chip, Disclosure, Page, Says, Table } from "../components/common";
import { Prose } from "../components/Prose";
import { splitSections } from "../components/Sections";
import { checkByName, checks } from "../data";
import { NotFound } from "./NotFound";

const explanationOf = (tree: string, name: string): string | undefined => {
  const treeSection = splitSections(checksMd).sections.find((section) => section.id === tree);
  if (!treeSection) return undefined;
  return splitSections(treeSection.body, 3).sections.find((section) => section.id === name)?.body;
};

export const CheckPage = () => {
  const { tree = "", name = "" } = useParams();
  const check = checkByName.get(`${tree}/${name}`);
  if (!check) return <NotFound />;
  const position = checks.checks.indexOf(check);
  const previous = checks.checks[position - 1];
  const next = checks.checks[position + 1];
  const mutations = checks.mutations.filter((mutation) => mutation.check === check.name && (mutation.tree === null || mutation.tree === check.tree));
  const explanation = explanationOf(check.tree, check.name);
  const subjects = Object.entries(check.subjects);

  return (
    <Page crumbs={[{ to: "/checks", label: "Lint checks" }, { to: `/checks#${check.tree}`, label: check.tree }]} title={check.name}>
      <p className="path">{check.file}</p>
      <Says who="says">{check.says}</Says>
      {subjects.length > 0 && (
        <>
          <h2 id="subjects">Subjects</h2>
          <Table head={["subject", "meaning"]} rows={subjects.map(([key, meaning]) => [<code key="k">{key}</code>, meaning])} />
        </>
      )}
      <h2 id="what-breaks">What breaks when it fails</h2>
      {explanation ? <Prose markdown={explanation} /> : <Callout kind="gap">No explanation has been written for this check.</Callout>}
      <h2 id="proof">Proof that it fires</h2>
      {mutations.length === 0 ? (
        <Callout kind="gap">No mutation in scripts/test/mutations.mjs names this check.</Callout>
      ) : (
        mutations.map((mutation, index) => (
          <div key={index}>
            <p>
              <Chip tone="test">mutation</Chip> {mutation.says} — the check must report <code>{mutation.names}</code>
              {mutation.subject && (
                <>
                  {" "}
                  under subject <code>{mutation.subject}</code>
                </>
              )}
              .
            </p>
            <ul className="section-list">
              {mutation.changes.map((change, changeIndex) => (
                <li key={changeIndex}>
                  <code>{change.path}</code> {change.remove ? <Chip tone="danger">removed</Chip> : change.edit ? <Chip tone="test">edited</Chip> : <Chip tone="shared">written</Chip>}
                  {change.write && <pre>{change.write}</pre>}
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
      <h2 id="source">The check itself</h2>
      <Disclosure summary={`${check.file} — ${check.source.split("\n").length} lines`}>
        <pre className="source">{check.source}</pre>
      </Disclosure>
      <p>
        {previous && (
          <>
            ← <Link to={`/checks/${previous.tree}/${previous.name}`}>{previous.name}</Link>
          </>
        )}
        {previous && next && " · "}
        {next && (
          <>
            <Link to={`/checks/${next.tree}/${next.name}`}>{next.name}</Link> →
          </>
        )}
      </p>
    </Page>
  );
};
