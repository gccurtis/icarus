import { describe, expect, it } from "vitest";
import { emptyDocumentBody } from "$documents/types/body";
import { emptySlideDeckBody } from "$slide-decks/types/body";
import { emptySpreadsheetBody } from "$spreadsheets/types/body";
import { resourceBodyOf, templateBodyValidator, type TemplateBody } from "$templates/types/body";

describe("templateBodyValidator", () => {
  it("discriminates on target, one member per general resource", () => {
    const targets = templateBodyValidator.members.map((member) => member.fields.target.value).sort();

    expect(targets).toEqual(["document", "slides", "spreadsheet"]);
  });

  /**
   * The body *is* the resource's body — a template is authored in the ordinary
   * editor, so a field the resource has and the template does not is a template
   * nobody can write.
   */
  it("carries the resource's own fields beside the discriminant", () => {
    const [document, slides, spreadsheet] = templateBodyValidator.members;

    expect(Object.keys(document.fields).sort()).toEqual(["target", "page", "styles", "rows", "header", "footer"].sort());
    expect(Object.keys(spreadsheet.fields).sort()).toEqual(["target", "sheets", "namedRanges", "styles"].sort());
    expect(Object.keys(slides.fields)).toContain("aspectRatio");
  });

  it("puts aspectRatio on the slides template alone, because the deck row carries it", () => {
    const withRatio = templateBodyValidator.members
      .filter((member) => "aspectRatio" in member.fields)
      .map((member) => member.fields.target.value);

    expect(withRatio).toEqual(["slides"]);
  });
});

describe("resourceBodyOf", () => {
  it("gives back exactly the document body the template was authored as", () => {
    const body: TemplateBody = { target: "document", ...emptyDocumentBody() };

    expect(resourceBodyOf(body)).toEqual(emptyDocumentBody());
  });

  it("drops aspectRatio with the discriminant, because it lives on the deck row", () => {
    const body: TemplateBody = { target: "slides", aspectRatio: "16:9", ...emptySlideDeckBody() };

    expect(resourceBodyOf(body)).toEqual(emptySlideDeckBody());
  });

  it("gives back exactly the workbook body", () => {
    const body: TemplateBody = { target: "spreadsheet", ...emptySpreadsheetBody() };

    expect(resourceBodyOf(body)).toEqual(emptySpreadsheetBody());
  });
});
