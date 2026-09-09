import { describe, expect, it } from "vitest";

import { codeLanguage, profileCode } from "$representation/data/behavior/semantic/materials/code";
import { parseCsv, profileCsv } from "$representation/data/behavior/semantic/materials/csv";
import { displayVariableValue } from "$representation/data/behavior/semantic/materials/spreadsheet";

describe("bounded semantic material profilers", () => {
  it("parses quoted CSV fields, escaped quotes, embedded newlines, and typed columns", () => {
    const source = "name,score,note\r\nAvery,42,\"line one\nline two\"\r\nMira,19,\"said \"\"hello\"\"\"";
    const { parsed, profile } = profileCsv(source);

    expect(parsed.rows).toEqual([
      ["name", "score", "note"],
      ["Avery", "42", "line one\nline two"],
      ["Mira", "19", "said \"hello\""]
    ]);
    expect(parsed.malformedRows).toBe(0);
    expect(profile).toMatchObject({
      rows: 2,
      columns: 3,
      headers: ["name", "score", "note"],
      columnsProfile: [
        { name: "name", inferredType: "text" },
        { name: "score", inferredType: "number", minimum: 19, maximum: 42 },
        { name: "note", inferredType: "text" }
      ]
    });
  });

  it("reports malformed and safety-limited CSV input instead of silently widening it", () => {
    const malformed = parseCsv("a,b\n1\n2,3,4");
    expect(malformed.malformedRows).toBe(2);
    expect(malformed.warnings.join(" ")).toMatch(/header width/);

    const bounded = parseCsv("a,b\n1,2\n3,4\n5,6", {
      maxBytes: 1_000,
      maxRows: 2,
      maxColumns: 2,
      maxCells: 4,
      sampleRows: 2
    });
    expect(bounded.rows).toEqual([["a", "b"], ["1", "2"]]);
    expect(bounded.truncated).toBe(true);
  });

  it("bounds code structure while retaining language and exact source ranges", () => {
    const profile = profileCode(
      "import thing from 'pkg'\nexport function alpha() {}\nconst beta = 2\nclass Gamma {}\n",
      "sample.ts",
      "text/typescript",
      { maxBytes: 10_000, maxLines: 3, maxSymbols: 2 }
    );
    expect(profile).toMatchObject({
      language: "typescript",
      lines: 5,
      imports: ["pkg"],
      truncated: true,
      symbols: [
        { name: "alpha", kind: "function", fromLine: 2, toLine: 2 },
        { name: "beta", kind: "variable", fromLine: 3, toLine: 3 }
      ]
    });
  });

  it("uses one code-profile language boundary for prose and source text", () => {
    expect(codeLanguage("notes.md", "text/markdown")).toBe("markdown");
    expect(codeLanguage("notes.txt", "text/plain")).toBe("plain-text");
    expect(codeLanguage("worker.ts", "text/plain")).toBe("typescript");
    expect(codeLanguage("config.json", "application/json")).toBe("json");
  });

  it("renders spreadsheet dates from represented parts without consulting ambient time", () => {
    expect(displayVariableValue({
      kind: "date",
      value: {
        calendar: "gregorian",
        year: 2027,
        month: 3,
        day: 4,
        hour: 5,
        minute: 6,
        utc: 0
      }
    })).toBe("2027-03-04T05:06:00.000Z");
  });
});
