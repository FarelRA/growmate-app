"use node";

import OpenAI from "openai";
import { v } from "convex/values";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { assistantContextValidator, buildChatMessages } from "./openai/prompt";
import {
  tools,
  resolveClientTimezoneOffsetMinutes,
  runAssistantToolCalls,
} from "./openai/tools";

export {
  parseToolArguments,
  resolveClientTimezoneOffsetMinutes,
  executeTool,
} from "./openai/tools";
export { buildSystemPrompt, assistantContextValidator } from "./openai/prompt";

function readLiveEnv(): Record<string, string | undefined> {
  return (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
}

const DEFAULT_OPENAI_BASE_URL = "https://gateway.farel.at.eu.org/v1";
const DEFAULT_OPENAI_MODEL = "gemini/gemini-3.1-flash-lite";

const AI_BACKEND_ENV_KEYS = ["OPENAI_BASE_URL", "OPENAI_API_KEY", "OPENAI_MODEL"] as const;

export type AiBackendEnvKey = (typeof AI_BACKEND_ENV_KEYS)[number];

export function getAiBackendStatus(): { configured: boolean; missing: string[] } {
  const live = readLiveEnv();
  const missing = AI_BACKEND_ENV_KEYS.filter((key) => !live[key]?.trim());
  return { configured: missing.length === 0, missing: [...missing] };
}

function getAiConfig(): { baseUrl: string; apiKey: string; model: string } {
  const live = readLiveEnv();
  const apiKey = live.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Asisten Floral tidak tersedia karena OPENAI_API_KEY belum dikonfigurasi.");
  }
  return {
    baseUrl: live.OPENAI_BASE_URL ?? DEFAULT_OPENAI_BASE_URL,
    apiKey,
    model: live.OPENAI_MODEL ?? DEFAULT_OPENAI_MODEL,
  };
}

export const generateAIResponse = internalAction({
  args: {
    threadId: v.id("assistantThreads"),
    assistantMessageId: v.id("assistantMessages"),
    userId: v.id("users"),
    deviceId: v.optional(v.string()),
    chatHistory: v.array(v.object({
      role: v.union(v.literal("assistant"), v.literal("user")),
      body: v.string(),
      createdAt: v.number(),
    })),
    context: assistantContextValidator,
  },
  handler: async (ctx, args) => {
    const backend = getAiBackendStatus();
    if (!backend.configured) {
      throw new Error("Asisten Floral tidak tersedia karena OPENAI_API_KEY belum dikonfigurasi.");
    }
    const aiConfig = getAiConfig();
    const apiKey = aiConfig.apiKey;

    try {
      const client = new OpenAI({
        apiKey,
        baseURL: aiConfig.baseUrl,
      });

      const messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam> =
        buildChatMessages(args.context, args.chatHistory);

      for (let step = 0; step < 4; step += 1) {
        const completion = await client.chat.completions.create({
          model: aiConfig.model,
          messages,
          tools,
          tool_choice: "auto",
          temperature: 0.35,
          max_tokens: 900,
        });

        const assistantMessage = completion.choices[0]?.message;
        if (!assistantMessage) {
          break;
        }

        if (!assistantMessage.tool_calls?.length) {
          const aiResponse = assistantMessage.content?.trim() || "I couldn't generate a useful response from the latest GrowMate context.";
          await ctx.runMutation(internal.assistant.insertAIResponse, {
            assistantMessageId: args.assistantMessageId,
            body: aiResponse,
            status: "complete",
          });
          return { response: aiResponse };
        }

        messages.push({
          role: "assistant",
          content: assistantMessage.content ?? "",
          tool_calls: assistantMessage.tool_calls,
        });

        const toolMessages = await runAssistantToolCalls(ctx, assistantMessage.tool_calls, {
          userId: args.userId,
          deviceId: args.deviceId,
          timezoneOffsetMinutes: resolveClientTimezoneOffsetMinutes(
            (args.context as { clientTimezoneOffsetMinutes?: unknown }).clientTimezoneOffsetMinutes,
          ),
        });
        messages.push(...toolMessages);
      }

      const fallback = "I couldn't complete that action safely. Please try again with a more specific request.";
      await ctx.runMutation(internal.assistant.insertAIResponse, {
        assistantMessageId: args.assistantMessageId,
        body: fallback,
        status: "complete",
      });
      return { response: fallback };
    } catch (error) {
      console.error("OpenAI-compatible request failed:", error);
      await ctx.runMutation(internal.assistant.insertAIResponse, {
        assistantMessageId: args.assistantMessageId,
        body: "Maaf, asisten sedang mengalami gangguan. Silakan coba lagi.",
        status: "error",
      });
      throw error;
    }
  },
});
