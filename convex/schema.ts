import { defineSchema, defineTable } from 'convex/server'
import { authTables } from '@convex-dev/auth/server'
import { v } from 'convex/values'

export default defineSchema({
  ...authTables,
  
  // ============================================
  // USERS - Profile fields optional until onboarding complete
  // ============================================
  users: defineTable({
    // Convex Auth fields (managed by Convex Auth)
    email: v.optional(v.string()),
    emailVerified: v.optional(v.number()),
    image: v.optional(v.string()),
    phone: v.optional(v.string()),
    phoneVerified: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    // Profile (filled during onboarding)
    name: v.optional(v.string()),
    handle: v.optional(v.string()),
    avatar: v.optional(v.string()),
    tier: v.optional(v.union(v.literal('basic'), v.literal('advanced'))),
    role: v.optional(v.union(v.literal('grower'), v.literal('company'), v.literal('admin'))),
    // Onboarding status
    setupComplete: v.optional(v.boolean()),
    // Timestamps
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  })
    .index('by_handle', ['handle'])
    .index('by_email', ['email'])
    .index('by_role', ['role']),

  plantCatalog: defineTable({
    key: v.string(),
    name: v.string(),
    species: v.string(),
    growthStage: v.union(
      v.literal('seed_dormancy'),
      v.literal('germination'),
      v.literal('seedling_development'),
      v.literal('vegetative_growth'),
      v.literal('flowering_reproduction'),
      v.literal('maturity_senescence')
    ),
    image: v.string(),
    imageStorageId: v.optional(v.id('_storage')),
    description: v.string(),
    location: v.string(),
    category: v.union(
      v.literal('herb'),
      v.literal('leafy'),
      v.literal('fruiting'),
      v.literal('houseplant'),
      v.literal('flower'),
      v.literal('microgreen')
    ),
    difficulty: v.union(v.literal('easy'), v.literal('medium'), v.literal('advanced')),
    wateringThreshold: v.number(),
    lightingThreshold: v.number(),
    lifecycleProfile: v.object({
      seedDormancyDays: v.number(),
      germinationDays: v.number(),
      seedlingDevelopmentDays: v.number(),
      vegetativeGrowthDays: v.number(),
      floweringReproductionDays: v.number(),
      maturitySenescenceDays: v.number(),
    }),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_key', ['key'])
    .index('by_category', ['category']),

  // ============================================
  // PLANTS - NEW MODEL: Owned by device, not user
  // Removed: userId, health (computed)
  // Added: deviceId (required)
  // Changed: stage → growthStage (enum)
  // ============================================
  plants: defineTable({
    deviceId: v.id('devices'),
    name: v.string(),
    species: v.string(),
    growthStage: v.union(
      v.literal('seed_dormancy'),
      v.literal('germination'),
      v.literal('seedling_development'),
      v.literal('vegetative_growth'),
      v.literal('flowering_reproduction'),
      v.literal('maturity_senescence')
    ),
    wateringThreshold: v.number(),
    lightingThreshold: v.number(),
    lifecycleProfile: v.object({
      seedDormancyDays: v.number(),
      germinationDays: v.number(),
      seedlingDevelopmentDays: v.number(),
      vegetativeGrowthDays: v.number(),
      floweringReproductionDays: v.number(),
      maturitySenescenceDays: v.number(),
    }),
    location: v.string(),
    image: v.optional(v.string()),
    archived: v.boolean(),
    archivedAt: v.optional(v.number()),
    plantedAt: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_device', ['deviceId'])
    .index('by_device_archived', ['deviceId', 'archived'])
    .index('by_createdAt', ['createdAt']),

  // ============================================
  // DEVICES - NEW MODEL: Owned by user
  // userId is optional to support unclaimed devices
  // Devices can be registered before user claims them
  // ============================================
  devices: defineTable({
    userId: v.optional(v.id('users')),
    deviceId: v.string(),
    name: v.string(),
    plantId: v.optional(v.id('plants')),
    // Automation Configuration
    autoWatering: v.boolean(),
    autoLighting: v.boolean(),
    wateringThreshold: v.number(),
    wateringDuration: v.number(),
    wateringCooldown: v.number(),
    lightingThreshold: v.number(),
    lightingHysteresis: v.number(),
    // Current State
    pumpEnabled: v.boolean(),
    lightEnabled: v.boolean(),
    lastWatered: v.optional(v.number()),
    lastLightChange: v.optional(v.number()),
    // Metadata
    lastSeen: v.number(),
    firmwareVersion: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_deviceId', ['deviceId'])
    .index('by_plant', ['plantId']),

  // ============================================
  // SENSORS - Removed: status, target, label, accent, sort (all computed)
  // ============================================
  sensors: defineTable({
    deviceId: v.string(),
    plantId: v.id('plants'),
    kind: v.union(
      v.literal('soil'),
      v.literal('light'),
      v.literal('temperature'),
      v.literal('air'),
      v.literal('water')
    ),
    value: v.number(),
    unit: v.string(),
    measuredAt: v.number(),
    createdAt: v.number(),
  })
    .index('by_plant', ['plantId'])
    .index('by_device', ['deviceId'])
    .index('by_device_and_kind', ['deviceId', 'kind'])
    .index('by_kind', ['plantId', 'kind'])
    .index('by_measuredAt', ['measuredAt']),

  // ============================================
  // SENSOR READINGS - NEW: Historical sensor data
  // ============================================
  sensorReadings: defineTable({
    deviceId: v.string(),
    plantId: v.id('plants'),
    kind: v.union(
      v.literal('soil'),
      v.literal('light'),
      v.literal('temperature'),
      v.literal('air'),
      v.literal('water')
    ),
    value: v.number(),
    unit: v.string(),
    measuredAt: v.number(),
  })
    .index('by_plant_kind', ['plantId', 'kind'])
    .index('by_device_and_kind', ['deviceId', 'kind'])
    .index('by_device', ['deviceId'])
    .index('by_measuredAt', ['measuredAt']),

  // ============================================
  // PLANT IMAGES - Historical camera/manual snapshots
  // ============================================
  plantImages: defineTable({
    plantId: v.id('plants'),
    deviceId: v.id('devices'),
    image: v.string(),
    source: v.union(v.literal('camera'), v.literal('manual')),
    capturedAt: v.number(),
  })
    .index('by_plant', ['plantId'])
    .index('by_device', ['deviceId'])
    .index('by_capturedAt', ['capturedAt']),

  // ============================================
  // AUTOMATION LOGS - Removed: reason (descriptive text)
  // ============================================
  automationLogs: defineTable({
    deviceId: v.string(),
    plantId: v.id('plants'),
    timestamp: v.number(),
    action: v.union(
      v.literal('pump_enabled'),
      v.literal('pump_disabled'),
      v.literal('light_on'),
      v.literal('light_off'),
      v.literal('manual_pump'),
      v.literal('manual_light'),
      v.literal('schedule_completed')
    ),
    soilValue: v.optional(v.number()),
    lightValue: v.optional(v.number()),
    threshold: v.optional(v.number()),
    duration: v.optional(v.number()),
  })
    .index('by_device', ['deviceId'])
    .index('by_plant', ['plantId'])
    .index('by_timestamp', ['timestamp']),

  // ============================================
  // GROW EVENTS - Device / plant / care audit trail
  // ============================================
  growEvents: defineTable({
    deviceId: v.optional(v.id('devices')),
    plantId: v.optional(v.id('plants')),
    userId: v.optional(v.id('users')),
    source: v.union(
      v.literal('user'),
      v.literal('device'),
      v.literal('system'),
      v.literal('automation')
    ),
    entityType: v.union(
      v.literal('device'),
      v.literal('plant'),
      v.literal('schedule'),
      v.literal('automation'),
      v.literal('sensor')
    ),
    eventType: v.union(
      v.literal('device_claimed'),
      v.literal('device_unclaimed'),
      v.literal('plant_assigned'),
      v.literal('plant_archived'),
      v.literal('plant_image_updated'),
      v.literal('sensor_recorded'),
      v.literal('manual_watering_triggered'),
      v.literal('automation_settings_updated'),
      v.literal('care_schedule_toggled'),
      v.literal('automation_action_executed'),
      v.literal('care_schedule_saved'),
      v.literal('care_schedule_completed'),
      v.literal('manual_lighting_triggered')
    ),
    title: v.string(),
    detail: v.optional(v.string()),
    data: v.optional(v.record(v.string(), v.union(v.string(), v.number(), v.boolean()))),
    timestamp: v.number(),
  })
    .index('by_device_and_timestamp', ['deviceId', 'timestamp'])
    .index('by_plant_and_timestamp', ['plantId', 'timestamp'])
    .index('by_user_and_timestamp', ['userId', 'timestamp'])
    .index('by_eventType_and_timestamp', ['eventType', 'timestamp'])
    .index('by_timestamp', ['timestamp']),

  // ============================================
  // CARE SCHEDULES - Changed: frequency → intervalDays, nextRun → nextRunAt
  // ============================================
  careSchedules: defineTable({
    plantId: v.id('plants'),
    title: v.string(),
    cadenceUnit: v.optional(v.union(v.literal('hours'), v.literal('days'))),
    cadenceValue: v.optional(v.number()),
    timeOfDayMinutes: v.optional(v.number()),
    timezoneOffsetMinutes: v.optional(v.number()),
    intervalDays: v.number(),
    intervalHours: v.optional(v.number()),
    nextRunAt: v.number(),
    lastRunAt: v.optional(v.number()),
    enabled: v.boolean(),
    createdAt: v.number(),
  })
    .index('by_plant', ['plantId'])
    .index('by_nextRunAt', ['nextRunAt']),

  // ============================================
  // ASSISTANT THREADS - Removed: assistantName, mood
  // ============================================
  assistantThreads: defineTable({
    userId: v.id('users'),
    title: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_user', ['userId']),

  // ============================================
  // ASSISTANT MESSAGES - Changed: createdAtLabel → createdAt
  // ============================================
  assistantMessages: defineTable({
    threadId: v.id('assistantThreads'),
    role: v.union(v.literal('assistant'), v.literal('user')),
    body: v.string(),
    status: v.union(v.literal('streaming'), v.literal('complete'), v.literal('error')),
    createdAt: v.number(),
  })
    .index('by_thread', ['threadId'])
    .index('by_createdAt', ['threadId', 'createdAt']),

  // ============================================
  // SUPPORT REQUESTS - Changed: status, priority to enums
  // ============================================
  supportRequests: defineTable({
    userId: v.id('users'),
    status: v.union(
      v.literal('open'),
      v.literal('in_progress'),
      v.literal('resolved'),
      v.literal('closed')
    ),
    priority: v.union(
      v.literal('low'),
      v.literal('normal'),
      v.literal('high'),
      v.literal('urgent')
    ),
    topic: v.string(),
    response: v.optional(v.string()),
    handledBy: v.optional(v.id('users')),
    createdAt: v.number(),
    updatedAt: v.number(),
    resolvedAt: v.optional(v.number()),
    respondedAt: v.optional(v.number()),
  })
    .index('by_user', ['userId'])
    .index('by_status', ['status']),

  supportMessages: defineTable({
    requestId: v.id('supportRequests'),
    senderUserId: v.optional(v.id('users')),
    senderRole: v.union(v.literal('user'), v.literal('admin'), v.literal('system')),
    body: v.string(),
    createdAt: v.number(),
  })
    .index('by_request', ['requestId'])
    .index('by_request_and_createdAt', ['requestId', 'createdAt']),

  // ============================================
  // PRODUCTS - Changed: seller → sellerId, distance → distanceMiles
  // ============================================
  products: defineTable({
    title: v.string(),
    description: v.string(),
    price: v.number(),
    category: v.string(),
    type: v.union(v.literal('official'), v.literal('community')),
    sellerId: v.id('users'),
    status: v.union(v.literal('active'), v.literal('reserved'), v.literal('sold'), v.literal('archived')),
    quantityAvailable: v.number(),
    quantityUnit: v.optional(v.string()),
    priceUnit: v.string(),
    locationLabel: v.optional(v.string()),
    sellerNote: v.optional(v.string()),
    contactPreference: v.optional(v.union(v.literal('chat'), v.literal('pickup'), v.literal('delivery'))),
    rating: v.number(),
    distanceMiles: v.optional(v.number()),
    image: v.string(),
    imageStorageId: v.optional(v.id('_storage')),
    featured: v.boolean(),
    shopeeUrl: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_type', ['type'])
    .index('by_type_and_status', ['type', 'status'])
    .index('by_seller', ['sellerId'])
    .index('by_seller_and_type', ['sellerId', 'type'])
    .index('by_featured', ['featured']),

  // ============================================
  // COMMUNITY POSTS - Removed: likes, comments, timestamp, badge (all computed)
  // ============================================
  communityPosts: defineTable({
    userId: v.id('users'),
    title: v.string(),
    body: v.string(),
    image: v.optional(v.string()),
    imageStorageId: v.optional(v.id('_storage')),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_createdAt', ['createdAt']),

  // ============================================
  // POST COMMENTS - Changed: timestamp → createdAt
  // ============================================
  postComments: defineTable({
    postId: v.id('communityPosts'),
    userId: v.id('users'),
    body: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_post', ['postId'])
    .index('by_user', ['userId']),

  // ============================================
  // POST LIKES - Added: createdAt
  // ============================================
  postLikes: defineTable({
    postId: v.id('communityPosts'),
    userId: v.id('users'),
    createdAt: v.number(),
  })
    .index('by_post', ['postId'])
    .index('by_user_and_post', ['userId', 'postId']),

  marketplaceThreads: defineTable({
    productId: v.id('products'),
    buyerId: v.id('users'),
    sellerId: v.id('users'),
    lastMessagePreview: v.string(),
    lastMessageAt: v.number(),
    buyerUnreadCount: v.number(),
    sellerUnreadCount: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_product', ['productId'])
    .index('by_product_and_buyer', ['productId', 'buyerId'])
    .index('by_buyer_and_lastMessageAt', ['buyerId', 'lastMessageAt'])
    .index('by_seller_and_lastMessageAt', ['sellerId', 'lastMessageAt']),

  marketplaceMessages: defineTable({
    threadId: v.id('marketplaceThreads'),
    senderId: v.id('users'),
    body: v.string(),
    createdAt: v.number(),
    readAt: v.optional(v.number()),
  })
    .index('by_thread_and_createdAt', ['threadId', 'createdAt'])
    .index('by_sender', ['senderId']),

  // ============================================
  // NOTIFICATIONS - Added: read, readAt, createdAt
  // ============================================
  notifications: defineTable({
    userId: v.id('users'),
    title: v.string(),
    detail: v.string(),
    kind: v.union(
      v.literal('assistant'),
      v.literal('system'),
      v.literal('commerce'),
      v.literal('social')
    ),
    read: v.boolean(),
    readAt: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_user_unread', ['userId', 'read'])
    .index('by_createdAt', ['createdAt']),

  newsletterSubscriptions: defineTable({
    email: v.string(),
    userId: v.optional(v.id('users')),
    source: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_email', ['email'])
    .index('by_user', ['userId']),

  // ============================================
  // LISTING DRAFTS - Restructured quantity/price
  // ============================================
  listingDrafts: defineTable({
    userId: v.id('users'),
    title: v.string(),
    description: v.string(),
    category: v.string(),
    quantity: v.number(),
    quantityUnit: v.string(),
    price: v.number(),
    priceUnit: v.string(),
    image: v.string(),
    imageStorageId: v.optional(v.id('_storage')),
    locationLabel: v.string(),
    contactPreference: v.union(v.literal('chat'), v.literal('pickup'), v.literal('delivery')),
    status: v.union(
      v.literal('draft'),
      v.literal('published'),
      v.literal('archived')
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index('by_user', ['userId']),

  // ============================================
  // USER ACTIVITIES - NEW: For points tracking
  // ============================================
  userActivities: defineTable({
    userId: v.id('users'),
    activityType: v.union(
      v.literal('post_created'),
      v.literal('comment_created'),
      v.literal('post_liked'),
      v.literal('plant_added'),
      v.literal('watering_completed')
    ),
    points: v.number(),
    relatedId: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_createdAt', ['createdAt']),

  // ============================================
  // USER BADGES - NEW: For achievements
  // ============================================
  userBadges: defineTable({
    userId: v.id('users'),
    badgeType: v.union(
      v.literal('watering_streak'),
      v.literal('solar_master'),
      v.literal('soil_scientist'),
      v.literal('community_contributor'),
      v.literal('silver_leaf'),
      v.literal('gold_leaf')
    ),
    earnedAt: v.number(),
  })
    .index('by_user', ['userId'])
    .index('by_earnedAt', ['earnedAt']),
})
