/**
 * Left-hand panel: load a knowledge base (PDF or pasted FAQ text).
 *
 * PDF parsing happens in the browser, so the file itself never leaves the
 * user's machine — only the extracted text is sent with a chat request.
 */
import { useRef, useState } from "react";
import { FileText, Loader2, Trash2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { extractPdfText, type KnowledgeSource } from "@/lib/knowledge-store";

type Props = {
  document: KnowledgeSource | null;
  onDocumentChange: (doc: KnowledgeSource | null) => void;
};

export function KnowledgePanel({ document, onDocumentChange }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pasted, setPasted] = useState("");
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setIsParsing(true);
    try {
      const text =
        file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")
          ? await extractPdfText(file)
          : await file.text();

      if (!text.trim()) {
        setError("No readable text found. Scanned PDFs (images) aren't supported.");
        return;
      }
      onDocumentChange({ name: file.name, text, addedAt: Date.now() });
    } catch (err) {
      console.error(err);
      setError("Couldn't read that file. Try a different PDF or paste the text instead.");
    } finally {
      setIsParsing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function handlePaste() {
    if (!pasted.trim()) return;
    onDocumentChange({ name: "Pasted FAQ", text: pasted.trim(), addedAt: Date.now() });
    setPasted("");
    setError(null);
  }

  const wordCount = document ? document.text.split(/\s+/).length : 0;

  return (
    <aside className="flex w-full shrink-0 flex-col gap-5 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-panel)] lg:w-[22rem]">
      <div>
        <h2 className="text-base font-semibold">Knowledge base</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          The assistant answers strictly from what you load here.
        </p>
      </div>

      {/* Currently loaded source ------------------------------------------ */}
      {document ? (
        <div className="rounded-xl border border-border bg-surface p-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 rounded-lg bg-accent p-2 text-accent-foreground">
              <FileText className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{document.name}</p>
              <p className="text-xs text-muted-foreground">
                {wordCount.toLocaleString()} words indexed
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="Remove knowledge base"
              onClick={() => onDocumentChange(null)}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-border bg-surface p-4 text-sm text-muted-foreground">
          Nothing loaded yet. Add a PDF or paste your FAQ to start chatting.
        </p>
      )}

      {/* Upload ------------------------------------------------------------ */}
      <div className="space-y-2">
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt,.md,application/pdf,text/plain"
          className="sr-only"
          onChange={(event) => handleFile(event.target.files?.[0])}
        />
        <Button
          variant="outline"
          className="w-full"
          disabled={isParsing}
          onClick={() => fileInputRef.current?.click()}
        >
          {isParsing ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
          {isParsing ? "Reading document…" : "Upload PDF or text file"}
        </Button>
      </div>

      {/* Paste -------------------------------------------------------------- */}
      <div className="space-y-2">
        <label htmlFor="faq-text" className="text-sm font-medium">
          Or paste FAQ text
        </label>
        <Textarea
          id="faq-text"
          value={pasted}
          onChange={(event) => setPasted(event.target.value)}
          placeholder={"Q: What is your refund window?\nA: 30 days from delivery…"}
          className="min-h-32 resize-none bg-surface"
        />
        <Button className="w-full" disabled={!pasted.trim()} onClick={handlePaste}>
          Use this text
        </Button>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <p className="mt-auto text-xs text-muted-foreground">
        Files are parsed in your browser and stored locally — nothing is saved on a server.
      </p>
    </aside>
  );
}
