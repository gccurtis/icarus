/**
 * The health payload this backend serves. The backend owns this shape because it
 * produces it; consumers declare their own expectation of the wire format.
 */
export interface ApiHealth {
  service: "backend";
  status: "ok";
  timestamp: string;
}

export const runHealthCapability = async (): Promise<ApiHealth> => ({
  service: "backend",
  status: "ok",
  timestamp: new Date().toISOString()
});
