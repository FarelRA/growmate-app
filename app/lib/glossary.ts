export const growmateTerms = {
  appName: 'GrowMate',
  publicNav: {
    products: 'Produk',
    marketplace: 'Marketplace',
    plantLibrary: 'Pustaka Tanaman',
    support: 'Dukungan',
    about: 'Tentang',
  },
  workspaceNav: {
    dashboard: 'Dashboard',
    assistant: 'Asisten',
    marketplace: 'Marketplace',
    community: 'Komunitas',
  },
  tiers: {
    basic: 'Dasar',
    advanced: 'Lanjutan',
  },
  roles: {
    grower: 'Petani individu',
    company: 'Perusahaan pertanian',
    admin: 'Admin',
  },
} as const

export function formatTierLabel(value?: 'basic' | 'advanced' | null) {
  if (!value) return '-'
  return growmateTerms.tiers[value]
}

export function formatRoleLabel(value?: 'grower' | 'company' | 'admin' | null) {
  if (!value) return '-'
  return growmateTerms.roles[value]
}
