import type { ApiHealth } from "@icarus/shared";

export const runHealthCapability = async (): Promise<ApiHealth> => ({
  service: "backend",
  status: "ok",
  timestamp: new Date().toISOString()
});
