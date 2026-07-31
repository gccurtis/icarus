import type { Usage } from "#platform/intelligence/types.js";

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  callId: string;
  name: string;
  ok: boolean;
  output?: unknown;
  error?: {
    code: string;
    message: string;
  };
}

export type ToolHandler = (args: Record<string, unknown>) => Promise<unknown>;

export interface ToolBinding {
  definition: ToolDefinition;
  handler: ToolHandler;
}

export interface ToolExecutionResponse {
  text: string;
  structured?: unknown;
  messages: unknown[];
  toolResults: ToolResult[];
  rounds: number;
  calls: number;
  usage: Usage;
}

export class ToolSet {
  private readonly handlers = new Map<string, ToolHandler>();

  constructor(private readonly bindings: ToolBinding[]) {
    for (const binding of bindings) {
      if (this.handlers.has(binding.definition.name)) {
        throw new Error(`Duplicate tool name: ${binding.definition.name}`);
      }
      this.handlers.set(binding.definition.name, binding.handler);
    }
  }

  definitions(): ToolDefinition[] {
    return this.bindings.map((binding) => ({ ...binding.definition }));
  }

  async execute(call: ToolCall): Promise<ToolResult> {
    const handler = this.handlers.get(call.name);
    if (!handler) {
      return {
        callId: call.id,
        name: call.name,
        ok: false,
        error: {
          code: "tool_not_found",
          message: `No tool handler found for '${call.name}'`
        }
      };
    }

    try {
      const output = await handler(call.arguments);
      return {
        callId: call.id,
        name: call.name,
        ok: true,
        output
      };
    } catch {
      return {
        callId: call.id,
        name: call.name,
        ok: false,
        error: {
          code: "tool_failed",
          message: `Tool '${call.name}' failed`
        }
      };
    }
  }
}
