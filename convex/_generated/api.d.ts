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
import type * as admin_blog from "../admin/blog.js";
import type * as admin_devices from "../admin/devices.js";
import type * as admin_plants from "../admin/plants.js";
import type * as admin_products from "../admin/products.js";
import type * as admin_stats from "../admin/stats.js";
import type * as admin_support from "../admin/support.js";
import type * as admin_users from "../admin/users.js";
import type * as assistant from "../assistant.js";
import type * as assistant_context from "../assistant/context.js";
import type * as assistant_quota from "../assistant/quota.js";
import type * as auth from "../auth.js";
import type * as blog from "../blog.js";
import type * as care from "../care.js";
import type * as care_schedules from "../care/schedules.js";
import type * as care_triggers from "../care/triggers.js";
import type * as community from "../community.js";
import type * as community_engagement from "../community/engagement.js";
import type * as community_posts from "../community/posts.js";
import type * as crons from "../crons.js";
import type * as customPassword from "../customPassword.js";
import type * as devices from "../devices.js";
import type * as devices_history from "../devices/history.js";
import type * as devices_queries from "../devices/queries.js";
import type * as helpers_auth from "../helpers/auth.js";
import type * as helpers_blog from "../helpers/blog.js";
import type * as helpers_devices from "../helpers/devices.js";
import type * as helpers_devices_defaults from "../helpers/devices/defaults.js";
import type * as helpers_devices_queued from "../helpers/devices/queued.js";
import type * as helpers_devices_summaries from "../helpers/devices/summaries.js";
import type * as helpers_devices_triggers from "../helpers/devices/triggers.js";
import type * as helpers_events from "../helpers/events.js";
import type * as helpers_generic from "../helpers/generic.js";
import type * as helpers_marketplace from "../helpers/marketplace.js";
import type * as helpers_plants from "../helpers/plants.js";
import type * as helpers_sensors from "../helpers/sensors.js";
import type * as helpers_v2sensors from "../helpers/v2sensors.js";
import type * as http from "../http.js";
import type * as marketplace from "../marketplace.js";
import type * as marketplace_listings from "../marketplace/listings.js";
import type * as marketplace_threads from "../marketplace/threads.js";
import type * as notifications from "../notifications.js";
import type * as openai from "../openai.js";
import type * as openai_prompt from "../openai/prompt.js";
import type * as openai_tools from "../openai/tools.js";
import type * as plants from "../plants.js";
import type * as seed from "../seed.js";
import type * as seed_admin from "../seed/admin.js";
import type * as seed_blog from "../seed/blog.js";
import type * as seed_community from "../seed/community.js";
import type * as seed_engagement from "../seed/engagement.js";
import type * as seed_images from "../seed/images.js";
import type * as seed_plants from "../seed/plants.js";
import type * as seed_products from "../seed/products.js";
import type * as seed_sensors from "../seed/sensors.js";
import type * as seed_support from "../seed/support.js";
import type * as seed_threads from "../seed/threads.js";
import type * as seedData_blog from "../seedData/blog.js";
import type * as seedData_communityListings from "../seedData/communityListings.js";
import type * as seedData_communityPosts from "../seedData/communityPosts.js";
import type * as seedData_devices from "../seedData/devices.js";
import type * as seedData_drafts from "../seedData/drafts.js";
import type * as seedData_fieldCrops from "../seedData/fieldCrops.js";
import type * as seedData_plants from "../seedData/plants.js";
import type * as seedData_products from "../seedData/products.js";
import type * as seedData_storage from "../seedData/storage.js";
import type * as seedData_threads from "../seedData/threads.js";
import type * as seedData_tickets from "../seedData/tickets.js";
import type * as seedData_types from "../seedData/types.js";
import type * as seedData_userPlants from "../seedData/userPlants.js";
import type * as seedData_users from "../seedData/users.js";
import type * as seedInternal from "../seedInternal.js";
import type * as sensors from "../sensors.js";
import type * as sensors_apply from "../sensors/apply.js";
import type * as streams from "../streams.js";
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
  "admin/blog": typeof admin_blog;
  "admin/devices": typeof admin_devices;
  "admin/plants": typeof admin_plants;
  "admin/products": typeof admin_products;
  "admin/stats": typeof admin_stats;
  "admin/support": typeof admin_support;
  "admin/users": typeof admin_users;
  assistant: typeof assistant;
  "assistant/context": typeof assistant_context;
  "assistant/quota": typeof assistant_quota;
  auth: typeof auth;
  blog: typeof blog;
  care: typeof care;
  "care/schedules": typeof care_schedules;
  "care/triggers": typeof care_triggers;
  community: typeof community;
  "community/engagement": typeof community_engagement;
  "community/posts": typeof community_posts;
  crons: typeof crons;
  customPassword: typeof customPassword;
  devices: typeof devices;
  "devices/history": typeof devices_history;
  "devices/queries": typeof devices_queries;
  "helpers/auth": typeof helpers_auth;
  "helpers/blog": typeof helpers_blog;
  "helpers/devices": typeof helpers_devices;
  "helpers/devices/defaults": typeof helpers_devices_defaults;
  "helpers/devices/queued": typeof helpers_devices_queued;
  "helpers/devices/summaries": typeof helpers_devices_summaries;
  "helpers/devices/triggers": typeof helpers_devices_triggers;
  "helpers/events": typeof helpers_events;
  "helpers/generic": typeof helpers_generic;
  "helpers/marketplace": typeof helpers_marketplace;
  "helpers/plants": typeof helpers_plants;
  "helpers/sensors": typeof helpers_sensors;
  "helpers/v2sensors": typeof helpers_v2sensors;
  http: typeof http;
  marketplace: typeof marketplace;
  "marketplace/listings": typeof marketplace_listings;
  "marketplace/threads": typeof marketplace_threads;
  notifications: typeof notifications;
  openai: typeof openai;
  "openai/prompt": typeof openai_prompt;
  "openai/tools": typeof openai_tools;
  plants: typeof plants;
  seed: typeof seed;
  "seed/admin": typeof seed_admin;
  "seed/blog": typeof seed_blog;
  "seed/community": typeof seed_community;
  "seed/engagement": typeof seed_engagement;
  "seed/images": typeof seed_images;
  "seed/plants": typeof seed_plants;
  "seed/products": typeof seed_products;
  "seed/sensors": typeof seed_sensors;
  "seed/support": typeof seed_support;
  "seed/threads": typeof seed_threads;
  "seedData/blog": typeof seedData_blog;
  "seedData/communityListings": typeof seedData_communityListings;
  "seedData/communityPosts": typeof seedData_communityPosts;
  "seedData/devices": typeof seedData_devices;
  "seedData/drafts": typeof seedData_drafts;
  "seedData/fieldCrops": typeof seedData_fieldCrops;
  "seedData/plants": typeof seedData_plants;
  "seedData/products": typeof seedData_products;
  "seedData/storage": typeof seedData_storage;
  "seedData/threads": typeof seedData_threads;
  "seedData/tickets": typeof seedData_tickets;
  "seedData/types": typeof seedData_types;
  "seedData/userPlants": typeof seedData_userPlants;
  "seedData/users": typeof seedData_users;
  seedInternal: typeof seedInternal;
  sensors: typeof sensors;
  "sensors/apply": typeof sensors_apply;
  streams: typeof streams;
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
