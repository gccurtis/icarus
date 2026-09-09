import { join } from "node:path";

import { check } from "../shared/check.mjs";
import { BASELINE_PATH, findingKey, readBaseline } from "../shared/baseline.mjs";
import { CHECKER_TREES } from "../shared/checker-trees.mjs";

const REQUIRED = [
  "checker",
  "contract",
  "pillar",
  "path",
  "fingerprint",
  "finding",
  "owner",
  "rationale",
  "removal",
  "review"
];
const REVIEW_HORIZON_DAYS = 183;

export default check({
  id: "COH-06",
  pillar: "cohesive-units",
  finding: "ARCH-14",
  baseline: false,
  name: "architecture-exceptions-expire",
  says: "Every debt-baseline entry is structurally unique, owned, linked, removable, and reviewed within six months.",
  subjects: {
    "baseline-shape": "the baseline is readable and every record has the required contract",
    "entry-is-live": "entries name a real checker, pillar, source, owner, and near-term review",
    "entry-is-unique": "one structural finding has one debt record"
  },
  run(tree) {
    const path = join(tree.base, BASELINE_PATH);
    let baseline;
    try {
      baseline = readBaseline(tree.base);
    } catch (error) {
      return [{
        subject: "baseline-shape",
        path,
        fingerprint: "invalid-json",
        message: `architecture baseline is not valid JSON: ${error.message}`
      }];
    }
    if (baseline.version !== 1 || !Array.isArray(baseline.findings)) {
      return [{
        subject: "baseline-shape",
        path,
        fingerprint: "invalid-root",
        message: "architecture baseline must be { version: 1, findings: [] }"
      }];
    }

    const found = [];
    const seen = new Set();
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const reviewHorizon = new Date(now.getTime() + REVIEW_HORIZON_DAYS * 24 * 60 * 60 * 1000);
    const catalogPath = join(tree.base, "configuration", "architecture-checkers.json");
    let contracts = {};
    try {
      contracts = JSON.parse(tree.read(catalogPath)).contracts ?? {};
    } catch {
      contracts = {};
    }
    for (const [index, entry] of baseline.findings.entries()) {
      const missing = REQUIRED.filter((field) => typeof entry[field] !== "string" || entry[field].trim() === "");
      const validPath = typeof entry.path === "string" && tree.exists(join(tree.base, entry.path));
      const validPillar = CHECKER_TREES.includes(entry.pillar);
      const validChecker =
        typeof entry.checker === "string" &&
        typeof entry.pillar === "string" &&
        tree.isFile(join(tree.base, "scripts", "lint", entry.pillar, `${entry.checker}.mjs`));
      const implementation = `${entry.pillar}/${entry.checker}.mjs`;
      const validContract =
        typeof entry.contract === "string" && contracts[entry.contract]?.includes(implementation);
      const reviewDate = /^\d{4}-\d{2}-\d{2}$/.test(entry.review ?? "")
        ? new Date(`${entry.review}T00:00:00Z`)
        : undefined;
      const validReview =
        reviewDate !== undefined &&
        !Number.isNaN(reviewDate.getTime()) &&
        reviewDate.toISOString().slice(0, 10) === entry.review;
      const future = validReview && entry.review > today;
      const timely = future && reviewDate <= reviewHorizon;
      if (
        missing.length > 0 ||
        !validPath ||
        !validPillar ||
        !validChecker ||
        !validContract ||
        !timely
      ) {
        found.push({
          subject: "entry-is-live",
          path,
          fingerprint: `entry:${index}`,
          message: `baseline entry ${index} is invalid (${[
            missing.length ? `missing ${missing.join(", ")}` : "",
            !validPath ? "source path does not exist" : "",
            !validPillar ? "pillar is unknown" : "",
            !validChecker ? "checker file does not exist" : "",
            !validContract ? "contract does not map to this checker" : "",
            !future
              ? "review is expired or invalid"
              : !timely
                ? `review exceeds the ${REVIEW_HORIZON_DAYS}-day horizon`
                : ""
          ].filter(Boolean).join("; ")})`
        });
      }
      const key = findingKey(entry);
      if (seen.has(key)) {
        found.push({
          subject: "entry-is-unique",
          path,
          fingerprint: `duplicate:${key}`,
          message: `duplicate baseline record for ${entry.checker} at ${entry.path}`
        });
      }
      seen.add(key);
    }
    return found;
  }
});
