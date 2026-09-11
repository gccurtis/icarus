import type { TemplateBody } from "$representation/data/types/templates/template";

import { fieldsOf, targetOf } from "$capabilities/templates/api/shared/validation";
import { validDocument } from "$capabilities/templates/api/shared/body-validation/document";
import { assertPortableBody } from "$capabilities/templates/api/shared/body-validation/portable";
import { assertStoredValue } from "$capabilities/templates/api/shared/body-validation/primitives";
import { validSlides } from "$capabilities/templates/api/shared/body-validation/slides";
import { validSpreadsheet } from "$capabilities/templates/api/shared/body-validation/spreadsheet";

export const bodyOf = (value: unknown, subject: string): TemplateBody => {
  assertStoredValue(value, subject);
  assertPortableBody(value, subject);
  const body = fieldsOf(value, subject);
  const target = targetOf(body.resource, subject);
  const valid =
    target === "document"
      ? validDocument(body)
      : target === "presentation"
        ? validSlides(body)
        : validSpreadsheet(body);
  if (!valid) {
    throw new Error(`templates/${subject}: body is not a valid ${target} template body`);
  }
  return value as TemplateBody;
};
