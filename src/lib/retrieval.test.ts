import { describe, it, expect } from "vitest";
import { chunkText, retrieveRelevantChunks, formatContext } from "./retrieval";

describe("chunkText", () => {
  it("returns an empty array for empty input", () => {
    expect(chunkText("   ")).toEqual([]);
  });

  it("returns a single chunk for short text", () => {
    const chunks = chunkText("short document");
    expect(chunks).toHaveLength(1);
    expect(chunks[0].index).toBe(1);
  });

  it("splits long text into overlapping chunks", () => {
    const chunks = chunkText("word ".repeat(500));
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks[0].text).toHaveLength(900);
    expect(chunks[0].text.slice(-150)).toBe(chunks[1].text.slice(0, 150));
  });
});

describe("retrieveRelevantChunks", () => {
  it("returns all chunks when there are few", () => {
    const doc = "one two three";
    expect(retrieveRelevantChunks(doc, "anything")).toHaveLength(1);
  });

  it("ranks chunks containing the question tokens higher", () => {
    const doc = [
      "The refund policy says customers can return items within thirty days.",
      "The shipping policy says we dispatch within five business days.",
    ].join(" ");
    const top = retrieveRelevantChunks(doc, "what is the refund policy", 1);
    expect(top[0].text).toContain("refund");
  });

  it("falls back to the first chunks when nothing matches", () => {
    const doc = "alpha beta gamma ".repeat(400);
    const top = retrieveRelevantChunks(doc, "zzzzzz", 5);
    expect(top).toHaveLength(5);
  });
});

describe("formatContext", () => {
  it("numbers chunks and separates them with a divider", () => {
    const out = formatContext([
      { index: 1, text: "hello" },
      { index: 2, text: "world" },
    ]);
    expect(out).toContain("[#1]");
    expect(out).toContain("[#2]");
    expect(out).toContain("---");
  });
});
