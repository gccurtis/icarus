import type { DerivedOutput } from "$representation/data/types/semantic/derived-output";

export const oneParagraph = (text: string): string => text.replace(/\s+/g, " ").trim();

const previousResponse = (output: DerivedOutput): string | undefined =>
  output.lastResponse?.type === "text" ? output.lastResponse.display : undefined;

export const synthesisUserPrompt = (output: DerivedOutput): string =>
  [
    `Task: ${output.prompt}`,
    output.origin === undefined
      ? "No originating resource was supplied."
      : `Originating resource for navigation only: ${output.origin.kind}:${output.origin.id}`,
    previousResponse(output) === undefined
      ? "There is no previous response."
      : `Previous response for stylistic continuity only (never factual evidence): ${previousResponse(output)}`
  ].join("\n\n");

export const templateUserPrompt = (output: DerivedOutput): string => {
  if (output.template === undefined) throw new Error("A templated synthesis requires a template");
  return [
    "Variables to resolve:",
    ...output.template.variables.map((variable) => `- ${variable.name}: ${variable.prompt}`),
    `Output template (structure only): ${output.template.output}`,
    output.template.exampleResponse === undefined
      ? "There is no example response."
      : `Example response for format and style only (never factual evidence): ${output.template.exampleResponse}`,
    previousResponse(output) === undefined
      ? "There is no previous response."
      : `Previous response for stylistic continuity only (never factual evidence): ${previousResponse(output)}`
  ].join("\n\n");
};
