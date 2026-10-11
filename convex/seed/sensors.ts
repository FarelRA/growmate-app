"use node";

import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import devicesData from "../seedData/devices";

const day = 86400000;
const HISTORY_DAYS = 30;

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round1 = (v: number) => Math.round(v * 10) / 10;

// ─── Sensor History (30 days × 5 kinds per device) ──────

export const sensors = internalAction({
  handler: async (ctx) => {
    const now = Date.now();
    let devices = 0;
    let rows = 0;

    for (const d of devicesData) {
      const device = await ctx.runQuery(internal.seedInternal.lookupDeviceById, {
        deviceId: d.deviceId,
      });
      if (!device) continue;
      const seeded = await ctx.runQuery(internal.seedInternal.hasSensorHistory, {
        deviceId: device._id,
      });
      if (seeded) continue;

      const indoor = device.version === "v1";
      const rng = mulberry32(hashStr(d.deviceId));
      const readings: Array<{ kind: "soil" | "light" | "temperature" | "air" | "water"; value: number; unit: string; measuredAt: number }> = [];

      for (let back = HISTORY_DAYS - 1; back >= 0; back--) {
        // Mid-morning reading with jitter; always in the past.
        const measuredAt = now - back * day - Math.floor(rng() * 3 * 3600000) - 2 * 3600000;
        const wave = Math.sin(back / 4.7);
        const cloudy = rng() < 0.2;
        const sun = Math.max(0, Math.sin(Math.PI * (0.35 + rng() * 0.2)));

        readings.push({
          kind: "soil",
          value: round1(clamp(55 + 10 * wave + (rng() * 8 - 4), 20, 90)),
          unit: "%",
          measuredAt,
        });
        readings.push({
          kind: "light",
          value: Math.round(clamp((indoor ? 900 : 55000) * sun * (cloudy ? 0.3 : 1), 0, indoor ? 1500 : 80000)),
          unit: "lux",
          measuredAt,
        });
        readings.push({
          kind: "temperature",
          value: round1(clamp(27 + 3.5 * wave + (rng() * 2 - 1), 22, 34)),
          unit: "°C",
          measuredAt,
        });
        readings.push({
          kind: "air",
          value: round1(clamp(72 - 8 * wave + (rng() * 8 - 4), 50, 95)),
          unit: "%",
          measuredAt,
        });
        readings.push({
          kind: "water",
          value: Math.round(clamp(88 - ((HISTORY_DAYS - 1 - back) * 2.4 % 68) + (rng() * 4 - 2), 5, 100)),
          unit: "%",
          measuredAt,
        });
      }

      const inserted = await ctx.runMutation(internal.seedInternal.bulkInsertSensorReadings, {
        deviceId: device._id,
        plantId: device.plantId,
        readings,
      });
      rows += inserted;
      devices += 1;
    }

    console.log(`[seed] sensors: ${rows} readings across ${devices} devices`);
  },
});
