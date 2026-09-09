export const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : "Something went wrong";
