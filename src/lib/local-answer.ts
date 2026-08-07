/**
 * Zero-config fallback "answer engine".
 *
 * When no LLM API key is configured (e.g. a plain Vercel deploy), the app can
 * still answer questions entirely on-device using the same retrieval pipeline
 * as the LLM path. This keeps the demo usable out of the box:
 *
 *   1. Retrieve the most relevant chunks (same scoring as retrieval.ts).
 *   2. Pull the highest-scoring sentences out of those chunks.
 *   3. Stream them back as a grounded, citation-style answer.
 *
 * It is deliberately simple and explainable — perfect for a portfolio demo
 * that must work with zero secrets.
 */
import { retrieveRelevantChunks, type Chunk } from "./retrieval";

const NO_MATCH_REPLY =
  "I don't have that in the provided documentation. Please contact a human agent for help with this.";

const STOP_WORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "but",
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "to",
  "of",
  "in",
  "on",
  "for",
  "with",
  "how",
  "what",
  "when",
  "where",
  "why",
  "who",
  "do",
  "does",
  "did",
  "can",
  "i",
  "you",
  "my",
  "your",
  "it",
  "this",
  "that",
  "there",
  "from",
  "at",
  "as",
  "by",
  "if",
  "about",
  "me",
  "we",
  "us",
  "our",
  "please",
  "tell",
]);

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token));
}

/** Split a chunk into trimmed sentences, keeping the chunk index for citations. */
function splitSentences(chunk: Chunk): { text: string; index: number }[] {
  return chunk.text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 8)
    .map((text) => ({ text, index: chunk.index }));
}

export function generateLocalAnswer(document: string, question: string): string {
  const chunks = retrieveRelevantChunks(document, question);
  const questionTokens = tokenize(question);
  if (questionTokens.length === 0) return NO_MATCH_REPLY;

  // Score each sentence by how many question tokens appear in it.
  const sentences = chunks.flatMap(splitSentences);
  const scored = sentences.map((sentence) => {
    const haystack = sentence.text.toLowerCase();
    let score = 0;
    for (const token of questionTokens) {
      if (haystack.includes(token)) score += 1;
    }
    return { ...sentence, score };
  });

  const matches = scored.filter((sentence) => sentence.score > 0).sort((a, b) => b.score - a.score);

  if (matches.length === 0) return NO_MATCH_REPLY;

  // Keep the best unique sentences, most relevant first.
  const seen = new Set<string>();
  const answer = matches
    .filter((sentence) => {
      const key = sentence.text.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 3)
    .map((sentence) => `• ${sentence.text}  (Source: [#${sentence.index}])`);

  return answer.join("\n");
}
