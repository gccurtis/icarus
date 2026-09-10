/** Bound and redact provider failures before persisting them with semantic jobs. */
export const safeSemanticFailure = (error: unknown): string =>
  (error instanceof Error ? error.message : "Semantic synchronization failed")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/(?:api[-_ ]?key)\s*[:=]\s*\S+/gi, "apiKey=[redacted]")
    .slice(0, 400);
