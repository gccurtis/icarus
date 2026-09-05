import { Link } from "react-router-dom";

import checksMd from "../prose/checks.md?raw";
import { Page, Says, Stat, Table } from "../components/common";
import { Prose } from "../components/Prose";
import { splitSections } from "../components/Sections";
import { firstSentence } from "../components/common";
import { checks } from "../data";

export const Checks = () => {
  const { lead, sections } = splitSections(checksMd);
  const how = sections.find((section) => section.id === "how-a-check-works");
  const shared = sections.find((section) => section.id === "the-shared-helpers");
  const subjects = checks.checks.reduce((sum, check) => sum + Object.keys(check.subjects).length, 0);
  return (
    <Page title="Lint checks" lede="Sixty-three checks, nine groups, every one quoted in its own words and proven to fire by a mutation.">
      <div className="stats">
        <Stat figure={checks.checks.length} label="checks" />
        <Stat figure={subjects} label="subjects" />
        <Stat figure={checks.mutations.length} label="mutations" />
        <Stat figure={checks.shared.length} label="shared helpers" />
      </div>
      {lead.trim() && <Prose markdown={lead} />}
      {how && (
        <section>
          <h2 id={how.id}>{how.title}</h2>
          <Prose markdown={how.body} />
        </section>
      )}
      {checks.order.map((tree) => (
        <section key={tree}>
          <h2 id={tree}>{tree}</h2>
          <p style={{ color: "var(--token-ink-muted)", fontSize: "var(--token-text-body-sm)" }}>
            <code>app/scripts/lint/{tree}/</code> · {checks.checks.filter((check) => check.tree === tree).length} checks
          </p>
          {checks.checks
            .filter((check) => check.tree === tree)
            .map((check) => (
              <Says key={check.name} who={<Link to={`/checks/${check.tree}/${check.name}`}>{check.name}</Link>}>
                {check.says}
                {Object.keys(check.subjects).length > 0 && (
                  <span style={{ display: "block", marginTop: "calc(var(--token-spacing-unit) * 1)", color: "var(--token-ink-muted)", fontSize: "var(--token-text-caption)" }}>
                    subjects: {Object.keys(check.subjects).join(", ")}
                  </span>
                )}
              </Says>
            ))}
        </section>
      ))}
      {shared && (
        <section>
          <h2 id={shared.id}>{shared.title}</h2>
          <Prose markdown={shared.body} />
          <Table head={["helper", "exports", "in its own words"]} rows={checks.shared.map((helper) => [<code key="n">{helper.name}</code>, <span key="s" style={{ fontFamily: "var(--token-font-mono)", fontSize: "var(--token-text-caption)" }}>{helper.symbols.join(", ")}</span>, helper.blurb ? firstSentence(helper.blurb) : ""])} />
        </section>
      )}
    </Page>
  );
};
