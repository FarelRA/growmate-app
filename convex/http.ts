import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { api } from "./_generated/api";
import { auth } from "./auth";

const http = httpRouter();
const env = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};

auth.addHttpRoutes(http);

// API endpoint for posting raw sensor data (0-4095 ADC values) with automation
http.route({
  path: "/api/sensors",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      // Parse request body
      const body = await request.json();
      
      // Validate API key (optional - check environment variable)
      const apiKey = request.headers.get("x-api-key");
      const expectedApiKey = env.SENSOR_API_KEY;
      
      if (expectedApiKey && apiKey !== expectedApiKey) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
      
      // Validate required fields
      if (!body.deviceId) {
        return new Response(JSON.stringify({ error: "deviceId is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      
      if (!body.plantId) {
        return new Response(JSON.stringify({ error: "plantId is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      
      // Support both single sensor update and batch updates
      const sensors = body.sensors || [{ kind: body.kind, raw: body.raw }];
      
      // Validate sensors array
      for (const sensor of sensors) {
        if (!sensor.kind || sensor.raw === undefined) {
          return new Response(JSON.stringify({ error: "Each sensor must have 'kind' and 'raw' value" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
          });
        }
        
        // Validate raw value range for ADC sensors
        if (['soil', 'light', 'water'].includes(sensor.kind)) {
          if (sensor.raw < 0 || sensor.raw > 4095) {
            return new Response(JSON.stringify({ 
              error: `Raw value for ${sensor.kind} must be between 0-4095 (got ${sensor.raw})` 
            }), {
              status: 400,
              headers: { "Content-Type": "application/json" },
            });
          }
        }
      }
      
      // Update sensors and get automation actions
      const result = await ctx.runMutation(api.growmate.updateSensorData, {
        deviceId: body.deviceId,
        plantId: body.plantId,
        sensors: sensors,
      });
      
      return new Response(JSON.stringify({ 
        success: true, 
        updated: result.updated,
        device: result.device,
        actions: result.actions || {},
        state: result.state,
        message: `Successfully updated ${result.updated} sensor(s)`
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
      
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Internal server error"
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }),
});

// API endpoint for uploading camera images (live feed)
http.route({
  path: "/api/camera",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      // Parse request body
      const body = await request.json();
      
      // Validate API key
      const apiKey = request.headers.get("x-api-key");
      const expectedApiKey = env.SENSOR_API_KEY;
      
      if (expectedApiKey && apiKey !== expectedApiKey) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        });
      }
      
      // Validate required fields
      if (!body.plantId) {
        return new Response(JSON.stringify({ error: "plantId is required" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      
      if (!body.image) {
        return new Response(JSON.stringify({ error: "image is required (base64 encoded)" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      
      // Validate base64 format
      let imageData = body.image;
      if (!imageData.startsWith('data:image/')) {
        // Add data URL prefix if not present
        imageData = `data:image/jpeg;base64,${imageData}`;
      }
      
      // Update plant image
      await ctx.runMutation(api.growmate.updatePlantImage, {
        plantId: body.plantId,
        image: imageData,
      });
      
      return new Response(JSON.stringify({ 
        success: true,
        message: "Camera image updated successfully",
        imageUrl: imageData.substring(0, 50) + "..." // Return truncated for confirmation
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
      
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Internal server error"
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }),
});

export default http;
