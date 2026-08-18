import type { Attachment } from "$model/client/copilot/types";

/**
 * Whether two attachments are the same one.
 *
 * **By kind and id**, which is what makes `attach` idempotent: pointing at the
 * same document twice is one chip, not two.
 *
 * A link is identified by its URL rather than by its fetch result. The same URL
 * fetched twice is one attachment — the second attempt may have succeeded where
 * the first failed, and replacing rather than appending is what lets a retry
 * update the chip in place.
 *
 * Shared because `attach` and `detach` must agree: an attachment that could be
 * added but not found again would be one the user cannot remove.
 */
export const attachmentKey = (attachment: Attachment): string =>
  attachment.kind === "link"
    ? `link ${attachment.url}`
    : `ref ${attachment.ref.kind} ${attachment.ref.id}`;

export const sameAttachment = (a: Attachment, b: Attachment): boolean =>
  attachmentKey(a) === attachmentKey(b);
