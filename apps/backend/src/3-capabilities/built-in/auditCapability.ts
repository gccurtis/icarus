import { setTimeout as sleep } from "node:timers/promises";

export interface AuditCapabilityInput {
  requestId?: string;
}

export const runAuditCapability = async (
  input: AuditCapabilityInput
): Promise<Record<string, unknown>> => {
  await sleep(250);

  return {
    acceptedRequestId: input.requestId,
    auditedAt: new Date().toISOString()
  };
};
