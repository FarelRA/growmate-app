"use node";

import OpenAI from "openai";
import { v } from "convex/values";
import type { ActionCtx } from "./_generated/server";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";

const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
const OPENAI_BASE_URL = env.OPENAI_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta/openai/";
const OPENAI_MODEL = env.OPENAI_MODEL ?? "gemini-3-flash-preview";

function buildSystemPrompt() {
  return [
    "You are Floral Assistant, the GrowMate AI copilot.",
    "You are an expert indoor growing and plant-care copilot focused on practical, device-aware guidance.",
    "Your job is to help the user care for the plant in their currently selected GrowMate device using the supplied live telemetry, automation settings, lifecycle stage, schedules, recent events, and chat history.",
    "Prioritize the provided GrowMate context over generic advice.",
    "If telemetry or context is missing, say exactly what is missing instead of pretending.",
    "Never claim you performed a physical action unless the tool result explicitly says it succeeded.",
    "When recommending actions, tie them to the actual thresholds, readings, lifecycle stage, and recent events in the context.",
    "Be concise but useful. Default to 4-8 short paragraphs or bullets when appropriate.",
    "When the user asks for diagnosis, explain the likely cause, confidence level, and the next best checks.",
    "When the user asks for planning, give a prioritized plan with timing.",
    "Do not invent unsupported sensor values, schedules, or species facts.",
    "Always use the provided sensor details, device settings, plant profile, plant health explanation, and health-computation rules when discussing plant status.",
    "If plant health is mentioned, explain it from the supplied health-computation section and the actual sensor statuses in context.",
    "When sensor data is missing, say that clearly and explain the impact on health/status conclusions.",
    "When useful, summarize sensor readings one by one with current value, status, target meaning, and likely care implication.",
    "You may use tools to act on the user's behalf when they clearly ask you to do so or strongly imply consent.",
    "Before using a tool, make sure the action matches the user's request and the current GrowMate context.",
    "If a tool fails, explain the failure and propose the next best option.",
  ].join("\n");
}

const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "trigger_watering",
      description: "Start a manual watering cycle for the user's active GrowMate device.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "set_lighting",
      description: "Turn the active GrowMate device light on or off.",
      parameters: {
        type: "object",
        properties: {
          enabled: { type: "boolean", description: "True to turn lighting on, false to turn it off." },
        },
        required: ["enabled"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_schedule",
      description: "Create a new care routine for the active plant.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          cadenceUnit: { type: "string", enum: ["hours", "days"] },
          cadenceValue: { type: "number" },
          timeOfDayMinutes: { type: "number", description: "Only for day-based schedules. Minutes after midnight local time." },
        },
        required: ["title", "cadenceUnit", "cadenceValue"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "toggle_schedule",
      description: "Pause or resume an existing care schedule by schedule id.",
      parameters: {
        type: "object",
        properties: {
          scheduleId: { type: "string" },
          enabled: { type: "boolean" },
        },
        required: ["scheduleId", "enabled"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_schedule",
      description: "Delete an existing care schedule by schedule id.",
      parameters: {
        type: "object",
        properties: {
          scheduleId: { type: "string" },
        },
        required: ["scheduleId"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_support_ticket",
      description: "Open a GrowMate support ticket on the user's behalf.",
      parameters: {
        type: "object",
        properties: {
          topic: { type: "string" },
        },
        required: ["topic"],
        additionalProperties: false,
      },
    },
  },
];

async function executeTool(ctx: ActionCtx, args: {
  userId: string;
  deviceId?: string;
  name: string;
  rawArguments: string;
}) {
  const parsed = args.rawArguments ? JSON.parse(args.rawArguments) : {};

  switch (args.name) {
    case "trigger_watering":
      return await ctx.runMutation(internal.growmate.assistantTriggerWatering, {
        userId: args.userId as never,
        deviceId: args.deviceId,
      });
    case "set_lighting":
      return await ctx.runMutation(internal.growmate.assistantTriggerLighting, {
        userId: args.userId as never,
        deviceId: args.deviceId,
        enabled: Boolean(parsed.enabled),
      });
    case "create_schedule":
      return await ctx.runMutation(internal.growmate.assistantCreateSchedule, {
        userId: args.userId as never,
        deviceId: args.deviceId,
        title: String(parsed.title ?? ""),
        cadenceUnit: parsed.cadenceUnit === "hours" ? "hours" : "days",
        cadenceValue: Number(parsed.cadenceValue ?? 1),
        timeOfDayMinutes: typeof parsed.timeOfDayMinutes === "number" ? parsed.timeOfDayMinutes : undefined,
        timezoneOffsetMinutes: -new Date().getTimezoneOffset(),
      });
    case "toggle_schedule":
      return await ctx.runMutation(internal.growmate.assistantToggleSchedule, {
        userId: args.userId as never,
        scheduleId: parsed.scheduleId as never,
        enabled: Boolean(parsed.enabled),
      });
    case "delete_schedule":
      return await ctx.runMutation(internal.growmate.assistantDeleteSchedule, {
        userId: args.userId as never,
        scheduleId: parsed.scheduleId as never,
      });
    case "create_support_ticket":
      return await ctx.runMutation(internal.growmate.assistantCreateSupportRequest, {
        userId: args.userId as never,
        topic: String(parsed.topic ?? ""),
      });
    default:
      throw new Error(`Unknown tool: ${args.name}`);
  }
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
    context: v.any(),
  },
  handler: async (ctx, args) => {
    const apiKey = env.OPENAI_API_KEY;

    if (!apiKey) {
      const message = "Floral Assistant is unavailable because OPENAI_API_KEY is not configured.";
      await ctx.runMutation(internal.growmate.insertAIResponse, {
        assistantMessageId: args.assistantMessageId,
        body: message,
        status: "error",
      });
      throw new Error(message);
    }

    try {
      const client = new OpenAI({
        apiKey,
        baseURL: OPENAI_BASE_URL,
      });

      const messages: Array<OpenAI.Chat.Completions.ChatCompletionMessageParam> = [
        { role: "system", content: buildSystemPrompt() },
        { role: "system", content: `Current GrowMate context:\n${JSON.stringify(args.context, null, 2)}` },
        ...args.chatHistory.map((message) => ({ role: message.role, content: message.body })),
      ];

      for (let step = 0; step < 4; step += 1) {
        const completion = await client.chat.completions.create({
          model: OPENAI_MODEL,
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
          await ctx.runMutation(internal.growmate.insertAIResponse, {
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

        for (const toolCall of assistantMessage.tool_calls) {
          if (toolCall.type !== "function") {
            continue;
          }
          try {
            const result = await executeTool(ctx, {
              userId: args.userId,
              deviceId: args.deviceId,
              name: toolCall.function.name,
              rawArguments: toolCall.function.arguments,
            });
            messages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify({ ok: true, result }),
            });
          } catch (error) {
            const message = error instanceof Error ? error.message : "Tool execution failed.";
            messages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: JSON.stringify({ ok: false, error: message }),
            });
          }
        }
      }

      const fallback = "I couldn't complete that action safely. Please try again with a more specific request.";
      await ctx.runMutation(internal.growmate.insertAIResponse, {
        assistantMessageId: args.assistantMessageId,
        body: fallback,
        status: "complete",
      });
      return { response: fallback };
    } catch (error) {
      console.error("OpenAI-compatible request failed:", error);
      const message = error instanceof Error
        ? `Floral Assistant failed: ${error.message}`
        : "Floral Assistant failed unexpectedly.";
      await ctx.runMutation(internal.growmate.insertAIResponse, {
        assistantMessageId: args.assistantMessageId,
        body: message,
        status: "error",
      });
      throw error;
    }
  },
});
