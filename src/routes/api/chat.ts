/**
 * Streaming chat endpoint.
 *
 * Flow:
 *  1. Browser POSTs { messages, document } to /api/chat.
 *  2. We take the latest user question and retrieve the most relevant chunks
 *     of the uploaded document (see src/lib/retrieval.ts).
 *  3. Those chunks become the ONLY knowledge the model is allowed to use.
 *  4. The answer is streamed back token-by-token.
 *
 * The model key never leaves the server.
 */
import { createFileRoute } from "@tanstack/react-router";
import { createOpenAI } from "@ai-sdk/openai";
import { convertToModelMessages, streamText, type UIMessage } from "ai";

import {
  createLovableAiGatewayRunIdFetch,
  getLovableAiGatewayResponseHeaders,
  getLovableAiGatewayRunId,
  withLovableAiGatewayRunIdHeader,
} from "@/lib/ai-gateway.server";
import { formatContext, retrieveRelevantChunks } from "@/lib/retrieval";

type ChatRequestBody = {
  messages?: UIMessage[];
  /** Full text of the uploaded PDF / pasted FAQ. */
  document?: string;
  /** Friendly name shown in the UI, e.g. "handbook.pdf". */
  documentName?: string;
};

/** Extract plain text out of a UIMessage's parts array. */
function messageText(message: UIMessage | undefined): string {
  if (!message) return "";
  return message.parts
    .map((part) => (part.type === "text" ? part.text : ""))
    .join(" ")
    .trim();
}

function buildSystemPrompt(context: string, documentName: string) {
  return [
    "You are a customer support assistant for a single company.",
    "",
    "STRICT GROUNDING RULES:",
    `- Answer ONLY using the knowledge base excerpts below (source: "${documentName}").`,
    "- If the answer is not contained in the excerpts, reply exactly:",
    '  "I don\'t have that in the provided documentation. Please contact a human agent for help with this."',
    "- Never use outside knowledge, never guess, never invent policies, prices, dates or contacts.",
    "- Cite the excerpt numbers you used at the end, like: Source: [#2], [#5].",
    "",
    "STYLE:",
    "- Warm, concise and practical. Short paragraphs or bullet points.",
    "- Keep answers under about 150 words unless the user asks for detail.",
    "",
    "KNOWLEDGE BASE EXCERPTS:",
    context || "(empty)",
  ].join("\n");
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as ChatRequestBody;
        const messages = body.messages;

        if (!Array.isArray(messages) || messages.length === 0) {
          return new Response("Messages are required", { status: 400 });
        }

        const document = (body.document ?? "").trim();
        if (!document) {
          return new Response(
            "No knowledge base loaded. Upload a PDF or paste FAQ text first.",
            { status: 400 },
          );
        }

        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) {
          return new Response("Missing LOVABLE_API_KEY", { status: 500 });
        }

        // --- Retrieval step -------------------------------------------------
        const question = messageText(messages[messages.length - 1]);
        const context = formatContext(retrieveRelevantChunks(document, question));

        // --- Model call -----------------------------------------------------
        const initialRunId = getLovableAiGatewayRunId(request);
        const runIdFetch = createLovableAiGatewayRunIdFetch(initialRunId);
        const lovable = createOpenAI({
          baseURL: "https://ai.gateway.lovable.dev/v1",
          apiKey,
          headers: {
            "Lovable-API-Key": apiKey,
            "X-Lovable-AIG-SDK": "vercel-ai-sdk",
          },
          fetch: runIdFetch.fetch,
        });

        try {
          const result = streamText({
            model: lovable.responses("openai/gpt-5.6-sol"),
            system: buildSystemPrompt(context, body.documentName || "knowledge base"),
            messages: await convertToModelMessages(messages),
            providerOptions: {
              // The gateway is stateless, so conversation history is resent
              // on every turn and nothing is stored server-side.
              openai: { store: false },
            },
          });

          const response = result.toUIMessageStreamResponse({
            originalMessages: messages,
            headers: getLovableAiGatewayResponseHeaders(undefined, {
              ...(initialRunId ? { "X-Lovable-AIG-Run-ID": initialRunId } : {}),
            }),
          });

          return withLovableAiGatewayRunIdHeader(response, runIdFetch);
        } catch (error) {
          console.error("[api/chat] gateway error", error);
          const message = error instanceof Error ? error.message : "Unknown error";
          // 429 = rate limited, 402 = out of credits: worth surfacing verbatim.
          const status = /429|rate limit/i.test(message)
            ? 429
            : /402|credit/i.test(message)
              ? 402
              : 500;
          return new Response(message, { status });
        }
      },
    },
  },
});
