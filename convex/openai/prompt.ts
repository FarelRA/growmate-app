import { v } from 'convex/values'
import type OpenAI from 'openai'

export function buildSystemPrompt() {
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

const sensorRangeValidator = v.object({ min: v.number(), max: v.number() })
const sensorProfileValidator = v.object({
  soil: sensorRangeValidator,
  light: sensorRangeValidator,
  temperature: sensorRangeValidator,
  air: sensorRangeValidator,
  water: sensorRangeValidator,
})
const lifecycleProfileValidatorLocal = v.object({
  seedDormancyDays: v.number(),
  germinationDays: v.number(),
  seedlingDevelopmentDays: v.number(),
  vegetativeGrowthDays: v.number(),
  floweringReproductionDays: v.number(),
  maturitySenescenceDays: v.number(),
})
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
})
export const assistantContextValidator = v.object({
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
  clientTimezoneOffsetMinutes: v.optional(v.number()),
})

export function buildAssistantContextMessage(context: unknown): string {
  return `Current GrowMate context:\n${JSON.stringify(context, null, 2)}`
}

export function buildChatMessages(
  context: unknown,
  chatHistory: Array<{
    role: 'assistant' | 'user'
    body: string
    createdAt: number
  }>,
): Array<OpenAI.Chat.Completions.ChatCompletionMessageParam> {
  return [
    { role: 'system', content: buildSystemPrompt() },
    { role: 'system', content: buildAssistantContextMessage(context) },
    ...chatHistory.map((message) => ({ role: message.role, content: message.body })),
  ]
}
