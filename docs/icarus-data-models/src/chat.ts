import type { RichBlockRef } from './rich-blocks.js';

export type ChatRole = 'human' | 'assistant' | 'system' | 'tool';

export interface ChatMessageContent {
  blocks: RichBlockRef[];
}

/** Shared message content only; Research and AgentTask own their conversations. */
