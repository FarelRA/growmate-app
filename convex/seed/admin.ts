"use node";

import { internalAction } from "../_generated/server";
import { api, internal } from "../_generated/api";
import usersData from "../seedData/users";
import devicesData from "../seedData/devices";
import userPlantsData from "../seedData/userPlants";
import type { Id } from "../_generated/dataModel";

function getEnv() {
  return (
    globalThis as { process?: { env?: Record<string, string | undefined> } }
  ).process?.env ?? {};
}

const day = 86400000;

// ─── Admin ────────────────────────────────────────────────

export const admin = internalAction({
  handler: async (ctx): Promise<string | undefined> => {
    const env = getEnv();
    const email = env.ADMIN_EMAIL;
    const password = env.ADMIN_PASSWORD;

    if (!email || !password) return;

    const existing = await ctx.runQuery(internal.users.adminLookupByEmail, { email });
    if (existing && existing.role === "admin") return;

    try {
      await ctx.runAction(api.auth.signIn, {
        provider: "password",
        params: { email, password, flow: "signUp" },
      });
    } catch (error) {
      if (
        !(error instanceof Error && error.message.toLowerCase().includes("already exists"))
      ) {
        throw error;
      }
    }

    const user = await ctx.runQuery(internal.users.adminLookupByEmail, { email });
    if (user && user.role !== "admin") {
      await ctx.runMutation(internal.users.internalSetAdminRole, {
        userId: user._id,
      });
    }

    return user?._id;
  },
});

// ─── Users ────────────────────────────────────────────────

export const users = internalAction({
  handler: async (ctx) => {
    const userIds: Id<"users">[] = [];
    let created = 0;

    for (const u of usersData) {
      const result = await ctx.runAction(internal.seedInternal.signUpUser, {
        email: u.email,
        password: u.password,
        name: u.name,
        handle: u.handle,
        role: u.role,
        tier: u.tier,
      });

      if (result.created) created += 1;
      userIds.push(result._id);
    }

    console.log(`[seed] users: ${created} created, ${userIds.length - created} already present`);
    return userIds;
  },
});

// ─── Devices ──────────────────────────────────────────────

export const devices = internalAction({
  handler: async (ctx) => {
    const deviceIds: string[] = [];
    let created = 0;

    for (const d of devicesData) {
      const existing = await ctx.runQuery(internal.seedInternal.lookupDeviceById, {
        deviceId: d.deviceId,
      });
      if (existing) {
        deviceIds.push(existing._id);
        continue;
      }

      await ctx.runMutation(internal.seedInternal.insertDevice, {
        deviceId: d.deviceId,
        name: d.name,
        version: d.version,
        lastSeen: d.lastSeen,
        firmwareVersion: d.firmwareVersion,
        hasModem: d.hasModem,
        hasSolarPanel: d.hasSolarPanel,
        batteryCapacityAh: d.batteryCapacityAh,
        batterySoC: d.batterySoC,
        tankCapacity: d.tankCapacity,
        autoWatering: d.autoWatering,
        autoLighting: d.autoLighting,
        wateringThreshold: d.wateringThreshold,
        wateringDuration: d.wateringDuration,
        wateringCooldown: d.wateringCooldown,
        lightingThreshold: d.lightingThreshold,
        lightingHysteresis: d.lightingHysteresis,
      });

      const inserted = await ctx.runQuery(internal.seedInternal.lookupDeviceById, {
        deviceId: d.deviceId,
      });
      if (!inserted) throw new Error(`[seed] device insert not visible: ${d.deviceId}`);
      deviceIds.push(inserted._id);
      created += 1;
    }

    console.log(`[seed] devices: ${created} created, ${deviceIds.length - created} already present`);
    return deviceIds;
  },
});

// ─── Claim Devices + Create Plants ────────────────────────

export const processClaims = internalAction({
  handler: async (ctx) => {
    const deviceDocs = await ctx.runQuery(internal.seedInternal.listAllDevices);
    const userIds: Id<"users">[] = [];

    // Collect all user IDs
    for (const u of usersData) {
      const user = await ctx.runQuery(internal.users.adminLookupByEmail, { email: u.email });
      if (user) userIds.push(user._id);
    }

    if (userIds.length === 0 || deviceDocs.length === 0) {
      console.log("[seed] No users or devices found, skipping claims");
      return;
    }

    // Claim one unclaimed device per user, bounded by both sides
    const pairs = Math.min(userIds.length, deviceDocs.length, userPlantsData.length);
    let claimed = 0;
    for (let i = 0; i < pairs; i++) {
      const device = deviceDocs[i];
      const userId = userIds[i];
      if (!device || !userId || device.userId) continue;

      await ctx.runMutation(internal.seedInternal.claimDeviceByUser, {
        deviceId: device._id,
        userId,
      });
      claimed += 1;
    }

    // Refresh device docs after claiming
    const refreshedDevices = await ctx.runQuery(internal.seedInternal.listAllDevices);

    // Create plants on the claimed devices
    let planted = 0;
    for (const up of userPlantsData) {
      const device = refreshedDevices[up.deviceIndex];
      if (!device?.userId) continue;

      // Look up plant catalog entry for sensor/lifecycle profile
      const catalogEntry = await ctx.runQuery(internal.seedInternal.lookupPlantByKey, {
        key: up.catalogKey,
      });
      if (!catalogEntry) continue;

      const plantId = await ctx.runMutation(internal.seedInternal.insertUserPlant, {
        deviceId: device._id,
        name: up.name,
        species: catalogEntry.species,
        growthStage: up.growthStage,
        wateringThreshold: catalogEntry.wateringThreshold,
        lightingThreshold: catalogEntry.lightingThreshold,
        sensorProfile: catalogEntry.sensorProfile,
        lifecycleProfile: catalogEntry.lifecycleProfile,
        location: catalogEntry.location,
        plantedAt: up.plantedAt,
      });
      planted += 1;

      // Create care schedule for plant
      await ctx.runMutation(internal.seedInternal.insertCareSchedule, {
        plantId,
        title: "Penyiraman Otomatis",
        cadenceUnit: "days",
        cadenceValue: 1,
        enabled: true,
        nextRunAt: up.plantedAt + day,
      });

      // Create grow event for planting
      await ctx.runMutation(internal.seedInternal.insertGrowEvent, {
        deviceId: device._id,
        plantId,
        userId: device.userId,
        source: "user",
        entityType: "plant",
        eventType: "plant_added",
        title: "Tanaman baru ditambahkan",
        detail: `${up.name} (${catalogEntry.species}) ditanam di perangkat ${device.name}`,
        timestamp: up.plantedAt,
      });

      // Create user activity
      await ctx.runMutation(internal.seedInternal.insertUserActivity, {
        userId: device.userId,
        activityType: "plant_added",
        points: 50,
        relatedId: plantId,
      });

      // Add some automation events for variety
      if (planted % 3 === 0) {
        await ctx.runMutation(internal.seedInternal.insertGrowEvent, {
          deviceId: device._id,
          plantId,
          userId: device.userId,
          source: "automation",
          entityType: "automation",
          eventType: "system_watering",
          title: "Penyiraman otomatis",
          detail: "Sistem menyiram tanaman secara otomatis berdasarkan sensor kelembaban",
          timestamp: up.plantedAt + 3 * day,
        });
      }
    }

    console.log(`[seed] claims: ${claimed} devices claimed, ${planted} plants planted`);
  },
});
