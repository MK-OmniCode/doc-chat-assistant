/**
 * Home page — the whole app.
 *
 * Owns the two pieces of state that live in localStorage:
 *  - the knowledge base (uploaded PDF text / pasted FAQ)
 *  - the single conversation
 */
import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import type { UIMessage } from "ai";

import logo from "@/assets/support-logo.png";
import { ChatPanel } from "@/components/chat-panel";
import { KnowledgePanel } from "@/components/knowledge-panel";
import { Toaster } from "@/components/ui/sonner";
import {
  clearConversation,
  loadDocument,
  loadMessages,
  saveDocument,
  saveMessages,
  type KnowledgeSource,
} from "@/lib/knowledge-store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Support Desk AI — Chat with your own documentation" },
      {
        name: "description",
        content:
          "Upload a PDF or paste your FAQ, then chat with an AI support agent that answers only from your own content.",
      },
      { property: "og:title", content: "Support Desk AI — Chat with your own documentation" },
      {
        property: "og:description",
        content:
          "A RAG-style customer support chatbot: upload a PDF or paste FAQ text and get grounded answers.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  // localStorage is browser-only, so hydrate after mount to avoid SSR mismatch.
  const [hydrated, setHydrated] = useState(false);
  const [document, setDocument] = useState<KnowledgeSource | null>(null);
  const [initialMessages, setInitialMessages] = useState<UIMessage[]>([]);

  useEffect(() => {
    setDocument(loadDocument());
    setInitialMessages(loadMessages());
    setHydrated(true);
  }, []);

  const handleDocumentChange = useCallback((doc: KnowledgeSource | null) => {
    setDocument(doc);
    saveDocument(doc);
  }, []);

  const handleMessagesChange = useCallback((messages: UIMessage[]) => {
    saveMessages(messages);
  }, []);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="border-b border-border bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-4">
          <img src={logo} alt="Support Desk AI logo" width={512} height={512} className="size-8" />
          <div>
            <h1 className="text-lg font-semibold">Support Desk AI</h1>
            <p className="text-xs text-muted-foreground">
              Grounded answers from your own documentation
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-4 py-6 lg:flex-row">
        <KnowledgePanel document={document} onDocumentChange={handleDocumentChange} />
        {hydrated && (
          <ChatPanel
            document={document}
            initialMessages={initialMessages}
            onMessagesChange={handleMessagesChange}
            onReset={clearConversation}
          />
        )}
      </main>

      <Toaster />
    </div>
  );
}
