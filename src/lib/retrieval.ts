/**
 * Tiny, dependency-free "R" of RAG (Retrieval Augmented Generation).
 *
 * Instead of a vector database we use keyword overlap scoring. For a single
 * uploaded document this is fast, has zero infrastructure, and is easy to
 * explain: chunk the text, score each chunk against the question, keep the
 * best few chunks, and hand only those to the model as context.
 */

export type Chunk = {
  /** 1-based index, used to build the [#n] citation labels shown to the model. */
  index: number;
  text: string;
};

const CHUNK_SIZE = 900; // characters — roughly a couple of paragraphs
const CHUNK_OVERLAP = 150; // keeps sentences from being cut in half between chunks

/** Split raw document text into overlapping chunks. */
export function chunkText(raw: string): Chunk[] {
  const text = raw.replace(/\s+/g, " ").trim();
  if (!text) return [];

  const chunks: Chunk[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + CHUNK_SIZE, text.length);
    chunks.push({ index: chunks.length + 1, text: text.slice(start, end) });
    if (end === text.length) break;
    start = end - CHUNK_OVERLAP;
  }
  return chunks;
}

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

/**
 * Score every chunk against the question and return the top matches.
 * Falls back to the first chunks when nothing matches, so the model always
 * receives *some* grounding context rather than an empty prompt.
 */
export function retrieveRelevantChunks(document: string, question: string, topK = 5): Chunk[] {
  const chunks = chunkText(document);
  if (chunks.length <= topK) return chunks;

  const questionTokens = tokenize(question);
  if (questionTokens.length === 0) return chunks.slice(0, topK);

  const scored = chunks.map((chunk) => {
    const haystack = chunk.text.toLowerCase();
    let score = 0;
    for (const token of questionTokens) {
      // count occurrences of the token in the chunk
      const matches = haystack.split(token).length - 1;
      if (matches > 0) score += 1 + Math.log(matches);
    }
    return { chunk, score };
  });

  const best = scored
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((entry) => entry.chunk)
    .sort((a, b) => a.index - b.index);

  return best.length > 0 ? best : chunks.slice(0, topK);
}

/** Format retrieved chunks into the numbered context block the prompt uses. */
export function formatContext(chunks: Chunk[]): string {
  return chunks.map((chunk) => `[#${chunk.index}]\n${chunk.text}`).join("\n\n---\n\n");
}
