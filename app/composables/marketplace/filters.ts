export type MarketplaceCategoryFilter = 'all' | 'official' | 'community'

export interface MarketplaceSearchableItem {
  title: string
  description: string
  category: string
  sellerName?: string
}

/**
 * Single source for marketplace search filtering. Both the authenticated
 * `useMarketplace` computeds and the public `marketplace.vue` page filter
 * through these helpers so the query semantics stay identical.
 */
function matchesQueryParts(query: string, ...parts: Array<string | null | undefined>) {
  const normalized = query.trim().toLowerCase()
  if (!normalized) return true
  return parts.filter(Boolean).join(' ').toLowerCase().includes(normalized)
}

export function matchesMarketplaceQuery(item: MarketplaceSearchableItem, query: string) {
  return matchesQueryParts(query, item.title, item.description, item.category, item.sellerName)
}

export function filterOfficialItems<T extends MarketplaceSearchableItem>(
  items: T[],
  query: string,
  selectedCategory: MarketplaceCategoryFilter,
) {
  if (selectedCategory === 'community') return []
  return items.filter((item) => matchesMarketplaceQuery(item, query))
}

export function filterCommunityItems<T extends MarketplaceSearchableItem>(
  items: T[],
  query: string,
  selectedCategory: MarketplaceCategoryFilter,
) {
  if (selectedCategory === 'official') return []
  return items.filter((item) => matchesMarketplaceQuery(item, query))
}
