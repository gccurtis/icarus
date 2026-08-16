const OFFSET = 0xcbf29ce484222325n;
const PRIME = 0x100000001b3n;
const MASK = 0xffffffffffffffffn;
const SECOND_SEED = 0x9e3779b97f4a7c15n;

const fnv1a = (text: string, seed: bigint): string => {
  let hash = OFFSET ^ seed;
  for (let i = 0; i < text.length; i++) {
    hash = ((hash ^ BigInt(text.charCodeAt(i))) * PRIME) & MASK;
  }
  return hash.toString(16).padStart(16, "0");
};

/**
 * FNV-1a over UTF-16 code units, seeded twice for 128 bits.
 *
 * Hand-rolled rather than `node:crypto`, which a Convex isolate does not have,
 * and rather than `crypto.subtle`, which is asynchronous and would make every
 * caller of a pure identity function await.
 *
 * **128 bits is not paranoia.** A collision here does not lose an artifact, it
 * silently gives one artifact another's identity — a window taking another
 * window's vector, or two unrelated cliques answering to one node id — and
 * nothing downstream could tell.
 */
export const digest128 = (material: string): string =>
  fnv1a(material, 0n) + fnv1a(material, SECOND_SEED);
