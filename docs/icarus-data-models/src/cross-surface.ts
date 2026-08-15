/** Compile-time examples showing one RichBlock contract across every surface. */

import type {
  DocumentBlockPlacement,
  SheetCell,
  SlideVisualElement,
} from './authored-resources.js';
import type { AgentTaskMessage } from './agent-tasks.js';
import type { Comment } from './collaboration.js';
import type { ResearchMessage } from './inquiry.js';
import type { RichBlockRef, TextRichBlock } from './rich-blocks.js';

type Assert<Condition extends true> = Condition;
type UsesRichBlock<Value> = Value extends RichBlockRef ? true : false;

export type DocumentUsesRichBlocks = Assert<
  UsesRichBlock<DocumentBlockPlacement['block']>
>;

export type SlidesUseRichBlocks = Assert<
  UsesRichBlock<SlideVisualElement['blocks'][number]['block']>
>;

export type SpreadsheetCellsUseRichBlocks = Assert<
  UsesRichBlock<SheetCell['blocks'][number]>
>;

export type CommentsUseTextBlocks = Assert<
  Comment['body'] extends RichBlockRef<'text'> ? true : false
>;

export type ResearchUsesRichBlocks = Assert<
  UsesRichBlock<ResearchMessage['content']['blocks'][number]>
>;

export type AgentTasksUseRichBlocks = Assert<
  UsesRichBlock<AgentTaskMessage['content']['blocks'][number]>
>;

/** A useful fixture shape for adapter and serializer tests. */
export interface CrossSurfaceRichBlockFixture {
  canonicalTextBlock: TextRichBlock;
  documentPlacement: DocumentBlockPlacement<'text'>;
  slideVisual: SlideVisualElement;
  spreadsheetCell: SheetCell;
  comment: Comment;
  researchMessage: ResearchMessage;
  agentTaskMessage: AgentTaskMessage;
}
