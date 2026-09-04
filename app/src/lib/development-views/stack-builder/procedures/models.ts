import type { ModelChoice } from "$development-views/stack-builder/types";

export const MODELS: readonly ModelChoice[] = [
  { id: "anthropic/claude-opus-5", label: "Claude Opus 5" },
  { id: "anthropic/claude-sonnet-5", label: "Claude Sonnet 5" },
  { id: "google/gemini-3.1-pro-preview", label: "Gemini 3.1 Pro" },
  { id: "google/gemini-3.8-flash", label: "Gemini 3.8 Flash" },
  { id: "openai/gpt-5.5", label: "GPT-5.5" },
  { id: "moonshotai/kimi-k3", label: "Kimi K3" },
  { id: "deepseek/deepseek-v4-pro-0813", label: "DeepSeek V4 Pro" },
  { id: "z-ai/glm-4.7", label: "GLM 4.7" },
  { id: "x-ai/grok-build-0.1", label: "Grok Build 0.1" },
  { id: "minimax/minimax-m2.7", label: "MiniMax M2.7" }
];

export const DEFAULT_MODEL = "anthropic/claude-sonnet-5";
