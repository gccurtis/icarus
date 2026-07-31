// Rich Text factory — creates the RichText runtime object wired with
// configuration and a logger, matching the pattern used by all other
// capabilities (Formula, Structured Data, Context, Knowledge, etc.).

import type { Logger } from "#platform/observability/logger.js";
import type { BackendConfig } from "#utils/config/loadBackendConfig.js";
import { createRichText } from "#rich-text/engine.js";
import type { RichText, RichTextConfig } from "#rich-text";
import { DEFAULT_STYLE } from "#rich-text";

export const createRichTextInstance = (
  config: BackendConfig,
  logger: Logger,
): RichText => {
  const rtConfig: RichTextConfig = {
    defaults: DEFAULT_STYLE,
    limits: config.richText,
  };
  return createRichText(rtConfig, logger);
};