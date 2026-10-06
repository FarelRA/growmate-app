import { computed, ref } from 'vue'
import { useConvexPaginatedQuery, useConvexQuery } from '@convex-vue/core'
import { api } from '~~/convex/_generated/api'
import { useAdminDevices } from './useAdminDevices'
import { useAdminProducts } from './useAdminProducts'
import { useAdminPlantPresets } from './useAdminPlantPresets'
import { useAdminBlog } from './useAdminBlog'
import { useAdminSupport } from './useAdminSupport'
import { useAdminUsers } from './useAdminUsers'
import type { AdminTab } from './useAdminDevices'

export function useAdmin() {
  // Paginated-only data path: every list below loads just its first page
  // (`useConvexPaginatedQuery` exposes the loaded pages as a flat array, so
  // `data` keeps the exact same keys and item shapes the dashboard page
  // consumes). Page sizes mirror the legacy array-query limits.
  const statsQuery = useConvexQuery(api.admin.adminStats, {})
  const recentEventsQuery = useConvexQuery(api.admin.adminRecentEvents, {})
  const devicesQuery = useConvexPaginatedQuery(api.admin.adminDevicesPaginated, {}, { numItems: 40 })
  const supportQuery = useConvexPaginatedQuery(api.admin.adminSupportPaginated, {}, { numItems: 30 })
  const productsQuery = useConvexPaginatedQuery(api.admin.adminProductsPaginated, {}, { numItems: 20 })
  const plantCatalogQuery = useConvexPaginatedQuery(api.admin.adminPlantCatalogPaginated, {}, { numItems: 64 })
  const blogQuery = useConvexPaginatedQuery(api.admin.adminBlogPostsPaginated, {}, { numItems: 24 })
  const usersQuery = useConvexPaginatedQuery(api.admin.adminUsersPaginated, {}, { numItems: 24 })

  const data = computed(() => {
    return {
      stats: statsQuery.data.value ?? {
        totalUsers: 0,
        totalDevices: 0,
        claimedDevices: 0,
        activePlants: 0,
        openTickets: 0,
        officialProducts: 0,
        communityListings: 0,
        communityPosts: 0,
        blogPosts: 0,
      },
      devices: devicesQuery.data.value ?? [],
      recentEvents: recentEventsQuery.data.value ?? [],
      supportRequests: supportQuery.data.value ?? [],
      officialProducts: productsQuery.data.value ?? [],
      plantCatalog: plantCatalogQuery.data.value ?? [],
      blogPosts: blogQuery.data.value ?? [],
      users: usersQuery.data.value ?? [],
    }
  })

  const activeTab = ref<AdminTab>('overview')

  const devices = useAdminDevices(activeTab)
  const products = useAdminProducts(activeTab)
  const plantPresets = useAdminPlantPresets(activeTab)
  const blog = useAdminBlog(activeTab)

  const supportRequests = computed(() => data.value.supportRequests)
  const support = useAdminSupport(supportRequests)

  const users = useAdminUsers()

  const tabs = [
    { key: 'overview', label: 'Ringkasan' },
    { key: 'devices', label: 'Perangkat' },
    { key: 'support', label: 'Dukungan' },
    { key: 'products', label: 'Produk Resmi' },
    { key: 'plants', label: 'Preset Tanaman' },
    { key: 'blog', label: 'Artikel' },
    { key: 'accounts', label: 'Akun' },
  ] as const

  return {
    data,
    activeTab,
    tabs,
    ...devices,
    ...products,
    ...plantPresets,
    ...blog,
    ...support,
    ...users,
  }
}
