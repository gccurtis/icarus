import { Link } from "react-router-dom";

import gapsMd from "../prose/gaps.md?raw";
import { Callout, Page } from "../components/common";
import { Sections } from "../components/Sections";
import { files, TREE_TITLES } from "../data";
import { coverageByTree, unitGaps } from "./Tests";

export const Gaps = () => {
  const coverage = coverageByTree();
  const gaps = unitGaps();
  const blurbless = files.filter((entry) => !entry.blurb && entry.kind !== "document" && entry.kind !== "test").length;
  return (
    <Page title="Gaps" lede="What this wiki could not verify, where the code and its documents disagree, and what extraction does not see.">
      <Sections
        markdown={gapsMd}
        after={{
          "what-extraction-does-not-see": (
            <Callout kind="record" label="From the extraction">
              {blurbless} source files carry no header comment. {files.filter((entry) => entry.kind === "document").length} documents were read and rendered as written; none was used as a citation for a claim about behaviour.
            </Callout>
          ),
          "test-gaps": (
            <Callout kind="gap" label="Derived from imports">
              <ul className="gap-list">
                {coverage.map((row) => (
                  <li key={row.tree}>
                    <Link to={`/tests`}>{TREE_TITLES[row.tree]}</Link>: {row.covered.length} of {row.sources.length} source modules imported by a test · {row.treeTests.length} test files
                  </li>
                ))}
                <li>capabilities without tests: {gaps.capabilities.join(", ") || "none"}</li>
                <li>model objects without tests: {gaps.objects.join(", ") || "none"}</li>
                <li>categories without procedure tests: {gaps.categories.join(", ") || "none"}</li>
                <li>surfaces without tests: {gaps.surfaces.join(", ") || "none"}</li>
                <li>development views without tests: {gaps.development.join(", ") || "none"}</li>
                <li>vocabularies no test imports: {gaps.vocabularies.join(", ") || "none"}</li>
              </ul>
            </Callout>
          )
        }}
      />
    </Page>
  );
};
