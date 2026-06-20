/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as admin from "../admin.js";
import type * as assistant from "../assistant.js";
import type * as auth from "../auth.js";
import type * as blog from "../blog.js";
import type * as care from "../care.js";
import type * as community from "../community.js";
import type * as crons from "../crons.js";
import type * as devices from "../devices.js";
import type * as helpers_auth from "../helpers/auth.js";
import type * as helpers_blog from "../helpers/blog.js";
import type * as helpers_devices from "../helpers/devices.js";
import type * as helpers_events from "../helpers/events.js";
import type * as helpers_generic from "../helpers/generic.js";
import type * as helpers_index from "../helpers/index.js";
import type * as helpers_marketplace from "../helpers/marketplace.js";
import type * as helpers_plants from "../helpers/plants.js";
import type * as helpers_sensors from "../helpers/sensors.js";
import type * as http from "../http.js";
import type * as marketplace from "../marketplace.js";
import type * as notifications from "../notifications.js";
import type * as openai from "../openai.js";
import type * as plants from "../plants.js";
import type * as sensors from "../sensors.js";
import type * as support from "../support.js";
import type * as types from "../types.js";
import type * as users from "../users.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  admin: typeof admin;
  assistant: typeof assistant;
  auth: typeof auth;
  blog: typeof blog;
  care: typeof care;
  community: typeof community;
  crons: typeof crons;
  devices: typeof devices;
  "helpers/auth": typeof helpers_auth;
  "helpers/blog": typeof helpers_blog;
  "helpers/devices": typeof helpers_devices;
  "helpers/events": typeof helpers_events;
  "helpers/generic": typeof helpers_generic;
  "helpers/index": typeof helpers_index;
  "helpers/marketplace": typeof helpers_marketplace;
  "helpers/plants": typeof helpers_plants;
  "helpers/sensors": typeof helpers_sensors;
  http: typeof http;
  marketplace: typeof marketplace;
  notifications: typeof notifications;
  openai: typeof openai;
  plants: typeof plants;
  sensors: typeof sensors;
  support: typeof support;
  types: typeof types;
  users: typeof users;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
