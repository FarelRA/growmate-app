export type { Doc, Id } from '../../convex/_generated/dataModel'
import type { Doc, Id } from '../../convex/_generated/dataModel'

/**
 * Shared row types for the admin console and marketplace surfaces.
 *
 * Each type starts from the generated Convex `Doc<>` for its table and adds
 * the enrichment fields the backend attaches (owner names, labels, message
 * authors, ...). Presentational components (`Admin*.vue`, `CarePanel.vue`,
 * `ListingGrid.vue`, `ListingForm.vue`) and the `useAdmin*` edit handlers
 * all share these so emit payloads stay assignable to handler params.
 */

/** Device row returned by the admin device-list queries. */
export interface AdminDeviceListItem {
  _id: Doc<'devices'>['_id']
  deviceId: string
  name: string
  ownerName: string | null
  ownerEmail: string | null
  firmwareVersion: string
  isClaimed: boolean
  plantName: string | null
  autoWatering: boolean
  autoLighting: boolean
  wateringThreshold: number
  wateringDuration: number
  wateringCooldown: number
  lightingThreshold: number
  lightingHysteresis: number
  lastSeen: number
  lastSeenLabel: string
  isOnline: boolean
  version: Doc<'devices'>['version']
  autoFertilizing: boolean
  autoPesticide: boolean
  fertilizingThreshold: number
  fertilizingDuration: number
  fertilizingCooldown: number
  pesticideThreshold: number
  pesticideDuration: number
  pesticideCooldown: number
  streamUrl?: string
  tankCapacity?: number
  tankMinLevel?: number
  batteryCapacityAh?: number
  batterySoC?: number
  batteryCurrent?: number
  reportedTankSwitchOpen?: boolean
  reportedDrawerSwitchOpen?: boolean
  modemImei?: string
  solarPanelWatts?: number
  hasModem?: boolean
  hasSolarPanel?: boolean
}

/** Support message with the sender display name attached by the backend. */
export interface AdminSupportMessage extends Doc<'supportMessages'> {
  senderName: string
  createdAtLabel: string
}

/** Support ticket with owner info, labels, and messages attached. */
export interface AdminSupportTicket extends Doc<'supportRequests'> {
  userName: string
  userEmail: string
  handledByName: string | null
  createdAtLabel: string
  updatedAtLabel: string
  messages: AdminSupportMessage[]
}

/** Operational event with its display label attached. */
export interface AdminRecentEvent extends Doc<'growEvents'> {
  timestampLabel: string
  /** Rendered by the overview template; absent in older payloads. */
  relativeTime?: string
}

/** Plant-catalog preset with a normalized (nullable) image URL. */
export type AdminPlantPresetItem = Omit<Doc<'plantCatalog'>, 'imageUrl'> & {
  imageUrl: string | null
}

/** Official product with marketplace display labels attached. */
export type AdminOfficialProduct = Omit<Doc<'products'>, 'imageUrl' | 'sellerId'> & {
  sellerName: string
  sellerAvatar: string
  sellerId?: Id<'users'>
  imageUrl: string | null
  priceLabel: string
  quantityLabel: string
  statusLabel: string
  contactThreadId: Id<'marketplaceThreads'> | null
}

/** Blog post with author name and display labels attached. */
export type AdminBlogPostItem = Omit<Doc<'blogPosts'>, 'imageUrl'> & {
  imageUrl: string | null
  authorName: string
  createdAtLabel: string
  relativeTime: string
}

/** Care schedule with its cadence/next-run labels attached. */
export interface CareScheduleItem extends Doc<'careSchedules'> {
  cadenceLabel: string
  timeLabel: string
  nextRunLabel: string
  lastRunLabel: string | null
}

/** Enriched official product shown in the marketplace grid. */
export type OfficialMarketplaceItem = AdminOfficialProduct

/** Enriched community listing shown in the marketplace grid. */
export type CommunityMarketplaceItem = Omit<Doc<'products'>, 'imageUrl' | 'sellerId'> & {
  sellerName: string
  sellerAvatar: string
  sellerId?: Id<'users'>
  imageUrl: string | null
  priceLabel: string
  quantityLabel: string
  statusLabel: string
  contactThreadId: Id<'marketplaceThreads'> | null
}

/** Listing draft with its display labels attached. */
export type ListingDraftItem = Omit<Doc<'listingDrafts'>, 'imageUrl'> & {
  imageUrl: string | null
  quantityLabel: string
  priceLabel: string
  statusLabel: string
}
