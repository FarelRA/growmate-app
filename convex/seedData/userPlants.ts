// Seed dataset — hand-maintained. Image bytes live in public/seed-images/<hash>/;
// this module carries only content hashes (see convex/seed/images.ts).
//
// 41 entries: one per device. Regular entries pair users seedData index ->
// explicit deviceId (no table-order dependence). Demo entries (demo: true)
// plant IAET-01, IAET-02, IAFU-01, IAFT-01, IAFT-02 for the demo account.

type GrowthStage = "seed_dormancy" | "germination" | "seedling_development" | "vegetative_growth" | "flowering_reproduction" | "maturity_senescence"

interface SeedUserPlant {
  userIndex: number
  demo?: boolean
  deviceId: string
  catalogKey: string
  name: string
  growthStage: GrowthStage
  plantedAt: number
}

const now = Date.now()
const day = 86400000

const seedData: SeedUserPlant[] = [
  // ─── Pods (indoor, IAET-03..18 -> users 0..15) ───
  { userIndex: 0, deviceId: "IAET-03", catalogKey: "kemangi", name: "Kemangi Dapur #1", growthStage: "vegetative_growth", plantedAt: now - 45 * day },
  { userIndex: 1, deviceId: "IAET-04", catalogKey: "selada", name: "Selada Hijau #1", growthStage: "vegetative_growth", plantedAt: now - 35 * day },
  { userIndex: 2, deviceId: "IAET-05", catalogKey: "bayam", name: "Bayam Cabut #1", growthStage: "flowering_reproduction", plantedAt: now - 60 * day },
  { userIndex: 3, deviceId: "IAET-06", catalogKey: "pakcoy", name: "Pakcoy Putih #1", growthStage: "vegetative_growth", plantedAt: now - 30 * day },
  { userIndex: 4, deviceId: "IAET-07", catalogKey: "mint", name: "Mint Wangi Kantor", growthStage: "vegetative_growth", plantedAt: now - 40 * day },
  { userIndex: 5, deviceId: "IAET-08", catalogKey: "selada", name: "Selada Romaine", growthStage: "seedling_development", plantedAt: now - 15 * day },
  { userIndex: 6, deviceId: "IAET-09", catalogKey: "kemangi", name: "Kemangi Thailand", growthStage: "seedling_development", plantedAt: now - 18 * day },
  { userIndex: 7, deviceId: "IAET-10", catalogKey: "stroberi", name: "Stroberi Dapur", growthStage: "flowering_reproduction", plantedAt: now - 70 * day },
  { userIndex: 8, deviceId: "IAET-11", catalogKey: "bayam", name: "Bayam Hijau #2", growthStage: "vegetative_growth", plantedAt: now - 35 * day },
  { userIndex: 9, deviceId: "IAET-12", catalogKey: "pakcoy", name: "Pakcoy Shanghai", growthStage: "seedling_development", plantedAt: now - 20 * day },
  { userIndex: 10, deviceId: "IAET-13", catalogKey: "lidah-mertua", name: "Lidah Mertua Sudut", growthStage: "vegetative_growth", plantedAt: now - 90 * day },
  { userIndex: 11, deviceId: "IAET-14", catalogKey: "selada", name: "Selada Keriting", growthStage: "vegetative_growth", plantedAt: now - 28 * day },
  { userIndex: 12, deviceId: "IAET-15", catalogKey: "kemangi", name: "Kemangi Biasa #2", growthStage: "seedling_development", plantedAt: now - 12 * day },
  { userIndex: 13, deviceId: "IAET-16", catalogKey: "mint", name: "Mint Hijau Balkon", growthStage: "vegetative_growth", plantedAt: now - 33 * day },
  { userIndex: 14, deviceId: "IAET-17", catalogKey: "bayam", name: "Bayam Merah", growthStage: "seedling_development", plantedAt: now - 22 * day },
  { userIndex: 15, deviceId: "IAET-18", catalogKey: "pakcoy", name: "Pakcoy Hijau #2", growthStage: "vegetative_growth", plantedAt: now - 32 * day },
  // ─── Tech (outdoor fields, IAFU-02..09 -> users 16..23) ───
  { userIndex: 16, deviceId: "IAFU-02", catalogKey: "cabai-rawit", name: "Cabai Rawit Merah", growthStage: "flowering_reproduction", plantedAt: now - 75 * day },
  { userIndex: 17, deviceId: "IAFU-03", catalogKey: "tomat-ceri", name: "Tomat Ceri Manis", growthStage: "flowering_reproduction", plantedAt: now - 70 * day },
  { userIndex: 18, deviceId: "IAFU-04", catalogKey: "bayam", name: "Bayam Hijau #3", growthStage: "flowering_reproduction", plantedAt: now - 65 * day },
  { userIndex: 19, deviceId: "IAFU-05", catalogKey: "stroberi", name: "Stroberi Kebun", growthStage: "vegetative_growth", plantedAt: now - 50 * day },
  { userIndex: 20, deviceId: "IAFU-06", catalogKey: "pakcoy", name: "Pakcoy Lapangan", growthStage: "vegetative_growth", plantedAt: now - 30 * day },
  { userIndex: 21, deviceId: "IAFU-07", catalogKey: "rosemary", name: "Rosemary Herbal", growthStage: "vegetative_growth", plantedAt: now - 55 * day },
  { userIndex: 22, deviceId: "IAFU-08", catalogKey: "cabai-rawit", name: "Cabai Rawit Hijau", growthStage: "vegetative_growth", plantedAt: now - 55 * day },
  { userIndex: 23, deviceId: "IAFU-09", catalogKey: "kemangi", name: "Kemangi Lahan", growthStage: "vegetative_growth", plantedAt: now - 38 * day },
  // ─── Tech-Addon (outdoor + modem/solar, IAFT-03..14 -> users 24..35) ───
  { userIndex: 24, deviceId: "IAFT-03", catalogKey: "cabai-rawit", name: "Cabai Rawit Orange", growthStage: "vegetative_growth", plantedAt: now - 50 * day },
  { userIndex: 25, deviceId: "IAFT-04", catalogKey: "tomat-ceri", name: "Tomat Ceri Kuning", growthStage: "vegetative_growth", plantedAt: now - 40 * day },
  { userIndex: 26, deviceId: "IAFT-05", catalogKey: "mint", name: "Mint Ladang", growthStage: "vegetative_growth", plantedAt: now - 36 * day },
  { userIndex: 27, deviceId: "IAFT-06", catalogKey: "bayam", name: "Bayam Petak Organik", growthStage: "vegetative_growth", plantedAt: now - 34 * day },
  { userIndex: 28, deviceId: "IAFT-07", catalogKey: "cabai-rawit", name: "Cabai Rawit Putih", growthStage: "seedling_development", plantedAt: now - 20 * day },
  { userIndex: 29, deviceId: "IAFT-08", catalogKey: "rosemary", name: "Rosemary Kebun Kopi", growthStage: "seedling_development", plantedAt: now - 25 * day },
  { userIndex: 30, deviceId: "IAFT-09", catalogKey: "tomat-ceri", name: "Tomat Ceri Anggur", growthStage: "vegetative_growth", plantedAt: now - 42 * day },
  { userIndex: 31, deviceId: "IAFT-10", catalogKey: "selada", name: "Selada Lapangan", growthStage: "vegetative_growth", plantedAt: now - 30 * day },
  { userIndex: 32, deviceId: "IAFT-11", catalogKey: "stroberi", name: "Stroberi Surya", growthStage: "flowering_reproduction", plantedAt: now - 68 * day },
  { userIndex: 33, deviceId: "IAFT-12", catalogKey: "pakcoy", name: "Pakcoy Percobaan", growthStage: "seedling_development", plantedAt: now - 16 * day },
  { userIndex: 34, deviceId: "IAFT-13", catalogKey: "tomat-ceri", name: "Tomat Ceri Melon House", growthStage: "vegetative_growth", plantedAt: now - 44 * day },
  { userIndex: 35, deviceId: "IAFT-14", catalogKey: "bayam", name: "Bayam Bawang Tumpang Sari", growthStage: "vegetative_growth", plantedAt: now - 37 * day },
  // ─── Demo account showcase plants ───
  { userIndex: -1, demo: true, deviceId: "IAET-01", catalogKey: "selada", name: "Selada Demo Dapur", growthStage: "vegetative_growth", plantedAt: now - 32 * day },
  { userIndex: -1, demo: true, deviceId: "IAET-02", catalogKey: "kemangi", name: "Kemangi Demo Ruang Tamu", growthStage: "vegetative_growth", plantedAt: now - 40 * day },
  { userIndex: -1, demo: true, deviceId: "IAFU-01", catalogKey: "cabai-rawit", name: "Cabai Demo Lahan", growthStage: "flowering_reproduction", plantedAt: now - 72 * day },
  { userIndex: -1, demo: true, deviceId: "IAFT-01", catalogKey: "tomat-ceri", name: "Tomat Demo Stasiun", growthStage: "vegetative_growth", plantedAt: now - 45 * day },
  { userIndex: -1, demo: true, deviceId: "IAFT-02", catalogKey: "stroberi", name: "Stroberi Demo Surya", growthStage: "flowering_reproduction", plantedAt: now - 66 * day },
]

export default seedData
