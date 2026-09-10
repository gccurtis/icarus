import { createResourceReadingContext } from "$capabilities/derived-output/api/shared/resource-reading-context";
import { materialInspectionTools } from "$capabilities/derived-output/api/shared/resource-reading-inspection-tools";
import { mediaReadingTools } from "$capabilities/derived-output/api/shared/resource-reading-media-tools";
import { structuredReadingTools } from "$capabilities/derived-output/api/shared/resource-reading-structured-tools";
import { textReadingTools } from "$capabilities/derived-output/api/shared/resource-reading-text-tools";
import { visualReadingTools } from "$capabilities/derived-output/api/shared/resource-reading-visual-tools";
import type { ResourceReadingSessionInput } from "$capabilities/derived-output/api/shared/resource-reading-context";

export const createResourceReadingSession = (input: ResourceReadingSessionInput) => {
  const context = createResourceReadingContext(input);
  const abortable = (tool: ReturnType<typeof textReadingTools>[number]) => ({
    ...tool,
    execute: async (value: unknown) => {
      input.signal?.throwIfAborted();
      const answer = await tool.execute(value);
      input.signal?.throwIfAborted();
      return answer;
    }
  });
  return {
    tools: [
      ...textReadingTools(context),
      ...materialInspectionTools(context),
      ...visualReadingTools(context),
      ...structuredReadingTools(context),
      ...mediaReadingTools(context)
    ].map(abortable),
    rememberMaterial: context.rememberMaterial
  };
};
