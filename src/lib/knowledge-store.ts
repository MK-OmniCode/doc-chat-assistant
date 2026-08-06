/**
 * Browser-side persistence + PDF text extraction.
 *
 * The user chose "save in this browser", so both the knowledge base and the
 * single conversation live in localStorage. No server, no database.
 */
import type { UIMessage } from "ai";

export type KnowledgeSource = {
  name: string;
  text: string;
  /** epoch ms */
  addedAt: number;
};

const DOC_KEY = "support-desk:document";
const MESSAGES_KEY = "support-desk:messages";

const isBrowser = () => typeof window !== "undefined";

export function loadDocument(): KnowledgeSource | null {
  if (!isBrowser()) return null;
  try {
    const raw = window.localStorage.getItem(DOC_KEY);
    return raw ? (JSON.parse(raw) as KnowledgeSource) : null;
  } catch {
    return null;
  }
}

export function saveDocument(doc: KnowledgeSource | null) {
  if (!isBrowser()) return;
  if (doc) window.localStorage.setItem(DOC_KEY, JSON.stringify(doc));
  else window.localStorage.removeItem(DOC_KEY);
}

export function loadMessages(): UIMessage[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(MESSAGES_KEY);
    const parsed = raw ? (JSON.parse(raw) as UIMessage[]) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveMessages(messages: UIMessage[]) {
  if (!isBrowser()) return;
  window.localStorage.setItem(MESSAGES_KEY, JSON.stringify(messages));
}

export function clearConversation() {
  if (!isBrowser()) return;
  window.localStorage.removeItem(MESSAGES_KEY);
}

/**
 * Read a PDF entirely in the browser with pdf.js — the file is never uploaded
 * anywhere; only the extracted text is sent with a chat request.
 */
export async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  // pdf.js needs a worker; Vite resolves this URL at build time.
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;

  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(
      content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim(),
    );
  }
  return pages.join("\n\n").trim();
}
