/**
 * Right-hand panel: the conversation itself.
 *
 * Built on AI Elements (Conversation / Message / PromptInput) over the AI SDK
 * `useChat` hook. Messages stream from /api/chat and are mirrored into
 * localStorage so a refresh restores the same single conversation.
 */
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { RotateCcw } from "lucide-react";
import { toast } from "sonner";

import logo from "@/assets/support-logo.png";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
} from "@/components/ai-elements/prompt-input";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Button } from "@/components/ui/button";
import type { KnowledgeSource } from "@/lib/knowledge-store";

type Props = {
  document: KnowledgeSource | null;
  initialMessages: UIMessage[];
  onMessagesChange: (messages: UIMessage[]) => void;
  onReset: () => void;
};

const SUGGESTIONS = [
  "What is the refund policy?",
  "How do I contact support?",
  "Summarise the key points",
];

export function ChatPanel({ document, initialMessages, onMessagesChange, onReset }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // The transport re-reads the document on every send, so swapping the
  // knowledge base mid-conversation immediately affects the next answer.
  const transport = useMemo(
    () =>
      new DefaultChatTransport<UIMessage>({
        api: "/api/chat",
        body: () => ({
          document: document?.text ?? "",
          documentName: document?.name ?? "",
        }),
      }),
    [document],
  );

  const { messages, sendMessage, status, stop, setMessages } = useChat({
    messages: initialMessages,
    transport,
    onError: (error) => toast.error(error.message || "Something went wrong. Please try again."),
  });

  // Persist the conversation in this browser.
  useEffect(() => {
    onMessagesChange(messages);
  }, [messages, onMessagesChange]);

  // Keep the composer focused: on mount, and whenever a response finishes.
  useEffect(() => {
    if (status === "ready") textareaRef.current?.focus();
  }, [status]);

  const isBusy = status === "submitted" || status === "streaming";

  const submit = useCallback(
    (text: string) => {
      if (!text.trim()) return;
      if (!document) {
        toast.error("Load a PDF or paste your FAQ first.");
        return;
      }
      void sendMessage({ text: text.trim() });
    },
    [document, sendMessage],
  );

  const handleReset = () => {
    stop();
    setMessages([]);
    onReset();
    textareaRef.current?.focus();
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--shadow-panel)]">
      {/* Header */}
      <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
        <div className="flex items-center gap-3">
          <img src={logo} alt="" width={512} height={512} className="size-9 rounded-lg" />
          <div>
            <h2 className="text-sm font-semibold">Support Assistant</h2>
            <p className="text-xs text-muted-foreground">
              {document ? `Answering from ${document.name}` : "No knowledge base loaded"}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleReset} disabled={messages.length === 0}>
          <RotateCcw className="size-4" />
          Reset chat
        </Button>
      </header>

      {/* Transcript */}
      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="mx-auto w-full max-w-2xl px-4 py-6">
          {messages.length === 0 ? (
            <ConversationEmptyState
              title="Ask about your documentation"
              description="Every answer is grounded in the content you loaded — nothing else."
              icon={<img src={logo} alt="" width={512} height={512} className="size-12" />}
            >
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((suggestion) => (
                  <Button
                    key={suggestion}
                    variant="secondary"
                    size="sm"
                    disabled={!document}
                    onClick={() => submit(suggestion)}
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
            </ConversationEmptyState>
          ) : (
            messages.map((message) => (
              <Message from={message.role} key={message.id}>
                <MessageContent>
                  {message.parts.map((part, index) =>
                    part.type === "text" ? (
                      <MessageResponse key={index}>{part.text}</MessageResponse>
                    ) : null,
                  )}
                </MessageContent>
              </Message>
            ))
          )}

          {/* Optimistic loading state before the first token arrives */}
          {status === "submitted" && (
            <Message from="assistant">
              <MessageContent>
                <Shimmer>Searching your documentation…</Shimmer>
              </MessageContent>
            </Message>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {/* Composer */}
      <div className="border-t border-border bg-surface px-4 py-4">
        <div className="mx-auto w-full max-w-2xl">
          <PromptInput
            onSubmit={(message, event) => {
              event.preventDefault();
              submit(message.text ?? "");
              event.currentTarget.reset();
            }}
          >
            <PromptInputTextarea
              ref={textareaRef}
              autoFocus
              disabled={!document}
              placeholder={
                document ? "Ask a question about your documentation…" : "Load a knowledge base first"
              }
            />
            <PromptInputFooter className="justify-end">
              <PromptInputSubmit status={status} disabled={!document || isBusy} onStop={stop} />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>
    </section>
  );
}
