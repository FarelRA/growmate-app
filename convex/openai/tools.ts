import type OpenAI from "openai";
import type { ActionCtx } from "../_generated/server";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";

export function parseToolArguments(rawArguments: string): {
  ok: true;
  value: Record<string, unknown>;
} | {
  ok: false;
  error: string;
} {
  if (!rawArguments) return { ok: true, value: {} };
  try {
    const value: unknown = JSON.parse(rawArguments);
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      return { ok: false, error: "Argumen tool harus berupa objek JSON." };
    }
    return { ok: true, value: value as Record<string, unknown> };
  } catch {
    return { ok: false, error: `Argumen tool bukan JSON valid: ${rawArguments.slice(0, 200)}` };
  }
}

export function resolveClientTimezoneOffsetMinutes(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : undefined;
}

export const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
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

export async function executeTool(ctx: ActionCtx, args: {
  userId: string;
  deviceId?: string;
  name: string;
  rawArguments: string;
  timezoneOffsetMinutes?: number;
}) {
  const parsedResult = parseToolArguments(args.rawArguments);
  if (!parsedResult.ok) {
    throw new Error(parsedResult.error);
  }
  const parsed = parsedResult.value as Record<string, unknown>;

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
        timezoneOffsetMinutes: resolveClientTimezoneOffsetMinutes(args.timezoneOffsetMinutes) ?? -new Date().getTimezoneOffset(),
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

// Tool loop extracted from the generateAIResponse action shell. Sequential,
// same tool-error envelope ({ ok, result } / { ok:false, error }) and same
// client-timezone threading into create_schedule as the inline loop.
export async function runAssistantToolCalls(
  ctx: ActionCtx,
  toolCalls: OpenAI.Chat.Completions.ChatCompletionMessageToolCall[],
  opts: {
    userId: string;
    deviceId?: string;
    timezoneOffsetMinutes?: number;
  },
): Promise<OpenAI.Chat.Completions.ChatCompletionToolMessageParam[]> {
  const toolMessages: OpenAI.Chat.Completions.ChatCompletionToolMessageParam[] = [];
  for (const toolCall of toolCalls) {
    if (toolCall.type !== "function") {
      continue;
    }
    try {
      const result = await executeTool(ctx, {
        userId: opts.userId,
        deviceId: opts.deviceId,
        name: toolCall.function.name,
        rawArguments: toolCall.function.arguments,
        timezoneOffsetMinutes: opts.timezoneOffsetMinutes,
      });
      toolMessages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify({ ok: true, result }),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Tool execution failed.";
      toolMessages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify({ ok: false, error: message }),
      });
    }
  }
  return toolMessages;
}
