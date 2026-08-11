export interface EchoCapabilityInput {
  method: string;
  path: string;
  body: unknown;
}

export const runEchoCapability = async (
  input: EchoCapabilityInput
): Promise<Record<string, unknown>> => ({
  method: input.method,
  path: input.path,
  body: input.body,
  processedAt: new Date().toISOString()
});
