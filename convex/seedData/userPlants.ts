// Auto-generated seed data for user plants — do not edit manually

type GrowthStage = "seed_dormancy" | "germination" | "seedling_development" | "vegetative_growth" | "flowering_reproduction" | "maturity_senescence"

interface SeedUserPlant {
  deviceIndex: number
  catalogKey: string
  name: string
  growthStage: GrowthStage
  plantedAt: number
}

const now = Date.now()
const day = 86400000

const seedData: SeedUserPlant[] = [
  {
    deviceIndex: 0,
    catalogKey: "kemangi",
    name: "Kemangi Dapur #1",
    growthStage: "vegetative_growth",
    plantedAt: now - 45 * day,
  },
  {
    deviceIndex: 1,
    catalogKey: "selada",
    name: "Selada Hijau #1",
    growthStage: "vegetative_growth",
    plantedAt: now - 35 * day,
  },
  {
    deviceIndex: 2,
    catalogKey: "bayam",
    name: "Bayam Cabut #1",
    growthStage: "flowering_reproduction",
    plantedAt: now - 60 * day,
  },
  {
    deviceIndex: 3,
    catalogKey: "pakcoy",
    name: "Pakcoy Putih #1",
    growthStage: "vegetative_growth",
    plantedAt: now - 30 * day,
  },
  {
    deviceIndex: 4,
    catalogKey: "cabai-rawit",
    name: "Cabai Rawit Merah",
    growthStage: "flowering_reproduction",
    plantedAt: now - 75 * day,
  },
  {
    deviceIndex: 5,
    catalogKey: "tomat-ceri",
    name: "Tomat Ceri Manis",
    growthStage: "flowering_reproduction",
    plantedAt: now - 70 * day,
  },
  {
    deviceIndex: 6,
    catalogKey: "kemangi",
    name: "Kemangi Thailand",
    growthStage: "seedling_development",
    plantedAt: now - 18 * day,
  },
  {
    deviceIndex: 7,
    catalogKey: "selada",
    name: "Selada Romaine",
    growthStage: "seedling_development",
    plantedAt: now - 15 * day,
  },
  {
    deviceIndex: 8,
    catalogKey: "bayam",
    name: "Bayam Hijau #2",
    growthStage: "vegetative_growth",
    plantedAt: now - 35 * day,
  },
  {
    deviceIndex: 9,
    catalogKey: "pakcoy",
    name: "Pakcoy Shanghai",
    growthStage: "seedling_development",
    plantedAt: now - 20 * day,
  },
  {
    deviceIndex: 10,
    catalogKey: "cabai-rawit",
    name: "Cabai Rawit Orange",
    growthStage: "vegetative_growth",
    plantedAt: now - 50 * day,
  },
  {
    deviceIndex: 11,
    catalogKey: "tomat-ceri",
    name: "Tomat Ceri Kuning",
    growthStage: "vegetative_growth",
    plantedAt: now - 40 * day,
  },
  {
    deviceIndex: 12,
    catalogKey: "kemangi",
    name: "Kemangi Biasa #2",
    growthStage: "seedling_development",
    plantedAt: now - 12 * day,
  },
  {
    deviceIndex: 13,
    catalogKey: "selada",
    name: "Selada Keriting",
    growthStage: "vegetative_growth",
    plantedAt: now - 28 * day,
  },
  {
    deviceIndex: 14,
    catalogKey: "bayam",
    name: "Bayam Merah",
    growthStage: "seedling_development",
    plantedAt: now - 22 * day,
  },
  {
    deviceIndex: 15,
    catalogKey: "pakcoy",
    name: "Pakcoy Hijau #2",
    growthStage: "vegetative_growth",
    plantedAt: now - 32 * day,
  },
  {
    deviceIndex: 16,
    catalogKey: "cabai-rawit",
    name: "Cabai Rawit Hijau",
    growthStage: "vegetative_growth",
    plantedAt: now - 55 * day,
  },
  {
    deviceIndex: 17,
    catalogKey: "tomat-ceri",
    name: "Tomat Ceri Anggur",
    growthStage: "vegetative_growth",
    plantedAt: now - 42 * day,
  },
  {
    deviceIndex: 18,
    catalogKey: "bayam",
    name: "Bayam Hijau #3",
    growthStage: "flowering_reproduction",
    plantedAt: now - 65 * day,
  },
  {
    deviceIndex: 19,
    catalogKey: "tomat-ceri",
    name: "Tomat Ceri Pear",
    growthStage: "flowering_reproduction",
    plantedAt: now - 80 * day,
  },
]

export default seedData
