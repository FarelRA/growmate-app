"use node";

import OpenAI from "openai";
import { v } from "convex/values";
import type { ActionCtx } from "./_generated/server";
import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
const OPENAI_BASE_URL = env.OPENAI_BASE_URL ?? "https://gateway.farel.at.eu.org/v1";
const OPENAI_MODEL = env.OPENAI_MODEL ?? "gemini/gemini-3.1-flash-lite";

const AI_BACKEND_ENV_KEYS = ["OPENAI_BASE_URL", "OPENAI_API_KEY", "OPENAI_MODEL"] as const;

export type AiBackendEnvKey = (typeof AI_BACKEND_ENV_KEYS)[number];

export function getAiBackendStatus(): { configured: boolean; missing: string[] } {
  const live = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
  const missing = AI_BACKEND_ENV_KEYS.filter((key) => !live[key]?.trim());
  return { configured: missing.length === 0, missing: [...missing] };
}

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
    "For V2 devices (version: 'v2'), the device supports fertilizing and pesticide solenoids in addition to watering. Use trigger_fertilizing for fertilizer application and trigger_pesticide for pesticide application. V2 devices do not have a grow light.",
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
  {
    type: "function",
    function: {
      name: "trigger_fertilizing",
      description: "Start a manual fertilizing cycle for the user's active V2 GrowMate device. Only available for V2 devices.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
    },
  },
  {
    type: "function",
    function: {
      name: "trigger_pesticide",
      description: "Start a manual pesticide application cycle for the user's active V2 GrowMate device. Only available for V2 devices.",
      parameters: { type: "object", properties: {}, additionalProperties: false },
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
      return await ctx.runMutation(internal.assistant.assistantTriggerWatering, {
        userId: args.userId as Id<'users'>,
        deviceId: args.deviceId,
      });
    case "set_lighting":
      return await ctx.runMutation(internal.assistant.assistantTriggerLighting, {
        userId: args.userId as Id<'users'>,
        deviceId: args.deviceId,
        enabled: Boolean(parsed.enabled),
      });
    case "create_schedule":
      return await ctx.runMutation(internal.assistant.assistantCreateSchedule, {
        userId: args.userId as Id<'users'>,
        deviceId: args.deviceId,
        title: String(parsed.title ?? ""),
        cadenceUnit: parsed.cadenceUnit === "hours" ? "hours" : "days",
        cadenceValue: Number(parsed.cadenceValue ?? 1),
        timeOfDayMinutes: typeof parsed.timeOfDayMinutes === "number" ? parsed.timeOfDayMinutes : undefined,
        timezoneOffsetMinutes: -new Date().getTimezoneOffset(),
      });
    case "toggle_schedule":
      return await ctx.runMutation(internal.assistant.assistantToggleSchedule, {
        userId: args.userId as Id<'users'>,
        scheduleId: parsed.scheduleId as Id<'careSchedules'>,
        enabled: Boolean(parsed.enabled),
      });
    case "delete_schedule":
      return await ctx.runMutation(internal.assistant.assistantDeleteSchedule, {
        userId: args.userId as Id<'users'>,
        scheduleId: parsed.scheduleId as Id<'careSchedules'>,
      });
    case "create_support_ticket":
      return await ctx.runMutation(internal.assistant.assistantCreateSupportRequest, {
        userId: args.userId as Id<'users'>,
        topic: String(parsed.topic ?? ""),
      });
    case "trigger_fertilizing":
      return await ctx.runMutation(internal.assistant.assistantTriggerFertilizing, {
        userId: args.userId as Id<'users'>,
        deviceId: args.deviceId,
      });
    case "trigger_pesticide":
      return await ctx.runMutation(internal.assistant.assistantTriggerPesticide, {
        userId: args.userId as Id<'users'>,
        deviceId: args.deviceId,
      });
    default:
      throw new Error(`Alat tidak dikenal: ${args.name}`);
  }
}

const sensorRangeValidator = v.object({ min: v.number(), max: v.number() });
const sensorProfileValidator = v.object({
  soil: sensorRangeValidator,
  light: sensorRangeValidator,
  temperature: sensorRangeValidator,
  air: sensorRangeValidator,
  water: sensorRangeValidator,
});
const lifecycleProfileValidatorLocal = v.object({
  seedDormancyDays: v.number(),
  germinationDays: v.number(),
  seedlingDevelopmentDays: v.number(),
  vegetativeGrowthDays: v.number(),
  floweringReproductionDays: v.number(),
  maturitySenescenceDays: v.number(),
});
const plantProgressValidator = v.object({
  currentStage: v.string(),
  currentStageLabel: v.string(),
  elapsedDays: v.number(),
  progressDays: v.number(),
  totalDays: v.number(),
  percent: v.number(),
  stages: v.array(
    v.object({
      key: v.string(),
      label: v.string(),
      duration: v.number(),
      startDay: v.number(),
      endDay: v.number(),
      complete: v.boolean(),
      active: v.boolean(),
    }),
  ),
});
const assistantContextValidator = v.object({
  user: v.object({ name: v.string(), tier: v.optional(v.string()) }),
  activeDevice: v.union(
    v.null(),
    v.object({
      name: v.string(),
      deviceId: v.string(),
      version: v.optional(v.string()),
      autoWatering: v.optional(v.boolean()),
      autoLighting: v.optional(v.boolean()),
      wateringThreshold: v.optional(v.number()),
      wateringDuration: v.optional(v.number()),
      wateringCooldown: v.optional(v.number()),
      lightingThreshold: v.optional(v.number()),
      lightingHysteresis: v.optional(v.number()),
      lightEnabled: v.optional(v.boolean()),
      autoFertilizing: v.optional(v.boolean()),
      autoPesticide: v.optional(v.boolean()),
      fertilizingThreshold: v.optional(v.number()),
      fertilizingDuration: v.optional(v.number()),
      fertilizingCooldown: v.optional(v.number()),
      pesticideThreshold: v.optional(v.number()),
      pesticideDuration: v.optional(v.number()),
      pesticideCooldown: v.optional(v.number()),
      lastFertilized: v.optional(v.union(v.string(), v.null())),
      lastPesticideApplied: v.optional(v.union(v.string(), v.null())),
      lastSeen: v.optional(v.string()),
      streamUrl: v.optional(v.string()),
      tankCapacity: v.optional(v.number()),
      tankMinLevel: v.optional(v.number()),
      batterySoC: v.optional(v.number()),
      batteryCurrent: v.optional(v.number()),
      batteryCapacityAh: v.optional(v.number()),
      reportedTankSwitchOpen: v.optional(v.boolean()),
      reportedDrawerSwitchOpen: v.optional(v.boolean()),
      hasModem: v.optional(v.boolean()),
      hasSolarPanel: v.optional(v.boolean()),
      modemImei: v.optional(v.string()),
      solarPanelWatts: v.optional(v.number()),
    }),
  ),
  activePlant: v.union(
    v.null(),
    v.object({
      name: v.string(),
      species: v.string(),
      health: v.optional(v.string()),
      growthStage: v.optional(v.string()),
      location: v.optional(v.string()),
      wateringThreshold: v.optional(v.number()),
      lightingThreshold: v.optional(v.number()),
      sensorProfile: v.optional(v.union(sensorProfileValidator, v.null())),
      progress: v.optional(plantProgressValidator),
      lifecycleProfile: v.optional(lifecycleProfileValidatorLocal),
    }),
  ),
  sensors: v.array(
    v.object({
      kind: v.string(),
      label: v.optional(v.string()),
      value: v.number(),
      unit: v.optional(v.string()),
      status: v.optional(v.string()),
      target: v.optional(v.string()),
    }),
  ),
  schedules: v.array(
    v.object({
      title: v.string(),
      enabled: v.optional(v.boolean()),
      nextRunAt: v.optional(v.string()),
      lastRunAt: v.optional(v.union(v.string(), v.null())),
      cadenceUnit: v.optional(v.string()),
      cadenceValue: v.optional(v.number()),
      timeOfDayMinutes: v.optional(v.union(v.number(), v.null())),
      cadenceLabel: v.optional(v.string()),
      timeLabel: v.optional(v.union(v.string(), v.null())),
    }),
  ),
  recentEvents: v.array(
    v.object({
      title: v.optional(v.string()),
      detail: v.optional(v.string()),
      time: v.optional(v.string()),
    }),
  ),
  automationLogs: v.array(
    v.object({
      action: v.optional(v.string()),
      soilValue: v.optional(v.number()),
      lightValue: v.optional(v.number()),
      threshold: v.optional(v.number()),
      duration: v.optional(v.number()),
      time: v.optional(v.string()),
    }),
  ),
});

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
    const apiKey = env.OPENAI_API_KEY as string;

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
