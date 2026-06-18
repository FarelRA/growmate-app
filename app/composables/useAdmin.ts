import { computed, ref } from 'vue'
import { useConvexQuery } from '@convex-vue/core'
import { api } from '@/lib/api'
import { useAdminDevices } from './useAdminDevices'
import { useAdminProducts } from './useAdminProducts'
import { useAdminPlantPresets } from './useAdminPlantPresets'
import { useAdminBlog } from './useAdminBlog'
import { useAdminSupport } from './useAdminSupport'
import { useAdminUsers } from './useAdminUsers'
import type { AdminTab } from './useAdminDevices'

export function useAdmin() {
  const overviewQuery = useConvexQuery(api.admin.adminOverview, {})
  const supportQuery = useConvexQuery(api.admin.adminSupportTickets, {})
  const productsQuery = useConvexQuery(api.admin.adminProductsList, {})
  const plantCatalogQuery = useConvexQuery(api.admin.adminPlantCatalogList, {})
  const blogQuery = useConvexQuery(api.admin.adminBlogPostsList, {})
  const usersQuery = useConvexQuery(api.admin.adminUsersList, {})

  const data = computed(() => {
    const overview = overviewQuery.data.value
    return {
      stats: overview?.stats ?? {
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
      devices: overview?.devices ?? [],
      recentEvents: overview?.recentEvents ?? [],
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
