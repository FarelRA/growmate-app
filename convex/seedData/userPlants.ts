// Seed dataset — hand-maintained. Image bytes live in public/seed-images/<hash>/;
// this module carries only content hashes (see convex/seed/images.ts).
//
// 41 entries: one per device. Regular entries pair users seedData index ->
// explicit deviceId (no table-order dependence). Demo entries (demo: true)
// plant IAET01, IAET02, IAFU01, IAFT01, IAFT02 for the demo account.

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
  // ─── Pods (indoor, IAET03..18 -> users 0..15) ───
  { userIndex: 0, deviceId: "IAET03", catalogKey: "kemangi", name: "Kemangi Dapur #1", growthStage: "vegetative_growth", plantedAt: now - 45 * day },
  { userIndex: 1, deviceId: "IAET04", catalogKey: "selada", name: "Selada Hijau #1", growthStage: "vegetative_growth", plantedAt: now - 35 * day },
  { userIndex: 2, deviceId: "IAET05", catalogKey: "bayam", name: "Bayam Cabut #1", growthStage: "flowering_reproduction", plantedAt: now - 60 * day },
  { userIndex: 3, deviceId: "IAET06", catalogKey: "pakcoy", name: "Pakcoy Putih #1", growthStage: "vegetative_growth", plantedAt: now - 30 * day },
  { userIndex: 4, deviceId: "IAET07", catalogKey: "mint", name: "Mint Wangi Kantor", growthStage: "vegetative_growth", plantedAt: now - 40 * day },
  { userIndex: 5, deviceId: "IAET08", catalogKey: "selada", name: "Selada Romaine", growthStage: "seedling_development", plantedAt: now - 15 * day },
  { userIndex: 6, deviceId: "IAET09", catalogKey: "kemangi", name: "Kemangi Thailand", growthStage: "seedling_development", plantedAt: now - 18 * day },
  { userIndex: 7, deviceId: "IAET10", catalogKey: "stroberi", name: "Stroberi Dapur", growthStage: "flowering_reproduction", plantedAt: now - 70 * day },
  { userIndex: 8, deviceId: "IAET11", catalogKey: "bayam", name: "Bayam Hijau #2", growthStage: "vegetative_growth", plantedAt: now - 35 * day },
  { userIndex: 9, deviceId: "IAET12", catalogKey: "pakcoy", name: "Pakcoy Shanghai", growthStage: "seedling_development", plantedAt: now - 20 * day },
  { userIndex: 10, deviceId: "IAET13", catalogKey: "lidah-mertua", name: "Lidah Mertua Sudut", growthStage: "vegetative_growth", plantedAt: now - 90 * day },
  { userIndex: 11, deviceId: "IAET14", catalogKey: "selada", name: "Selada Keriting", growthStage: "vegetative_growth", plantedAt: now - 28 * day },
  { userIndex: 12, deviceId: "IAET15", catalogKey: "kemangi", name: "Kemangi Biasa #2", growthStage: "seedling_development", plantedAt: now - 12 * day },
  { userIndex: 13, deviceId: "IAET16", catalogKey: "mint", name: "Mint Hijau Balkon", growthStage: "vegetative_growth", plantedAt: now - 33 * day },
  { userIndex: 14, deviceId: "IAET17", catalogKey: "bayam", name: "Bayam Merah", growthStage: "seedling_development", plantedAt: now - 22 * day },
  { userIndex: 15, deviceId: "IAET18", catalogKey: "pakcoy", name: "Pakcoy Hijau #2", growthStage: "vegetative_growth", plantedAt: now - 32 * day },
  // ─── Tech (outdoor fields, IAFU02..09 -> users 16..23) ───
  // Dry-season crops for the late-kemarau -> rendeng transition.
  { userIndex: 16, deviceId: "IAFU02", catalogKey: "kacang-hijau-vima-1", name: "Kacang Hijau Vima", growthStage: "vegetative_growth", plantedAt: now - 35 * day },
  { userIndex: 17, deviceId: "IAFU03", catalogKey: "jagung-manis-bonanza", name: "Jagung Bonanza", growthStage: "flowering_reproduction", plantedAt: now - 65 * day },
  { userIndex: 18, deviceId: "IAFU04", catalogKey: "kedelai-anjasmoro", name: "Kedelai Anjasmoro", growthStage: "flowering_reproduction", plantedAt: now - 70 * day },
  { userIndex: 19, deviceId: "IAFU05", catalogKey: "kacang-tanah-gajah", name: "Kacang Tanah Gajah", growthStage: "vegetative_growth", plantedAt: now - 50 * day },
  { userIndex: 20, deviceId: "IAFU06", catalogKey: "bawang-merah-brebes", name: "Bawang Brebes", growthStage: "vegetative_growth", plantedAt: now - 40 * day },
  { userIndex: 21, deviceId: "IAFU07", catalogKey: "cabai-merah-besar-tw", name: "Cabai TW Lapangan", growthStage: "flowering_reproduction", plantedAt: now - 75 * day },
  { userIndex: 22, deviceId: "IAFU08", catalogKey: "terong-ungu-panjang", name: "Terong Ungu Lapangan", growthStage: "vegetative_growth", plantedAt: now - 45 * day },
  { userIndex: 23, deviceId: "IAFU09", catalogKey: "mentimun-baby", name: "Mentimun Baby", growthStage: "vegetative_growth", plantedAt: now - 30 * day },
  // ─── Tech-Addon (outdoor + modem/solar, IAFT03..14 -> users 24..35) ───
  { userIndex: 24, deviceId: "IAFT03", catalogKey: "cabai-merah-besar-tw", name: "Cabai TW Stasiun", growthStage: "vegetative_growth", plantedAt: now - 50 * day },
  { userIndex: 25, deviceId: "IAFT04", catalogKey: "jagung-manis-bonanza", name: "Jagung Stasiun", growthStage: "vegetative_growth", plantedAt: now - 40 * day },
  { userIndex: 26, deviceId: "IAFT05", catalogKey: "kacang-hijau-vima-1", name: "Kacang Hijau Ladang", growthStage: "vegetative_growth", plantedAt: now - 36 * day },
  { userIndex: 27, deviceId: "IAFT06", catalogKey: "kedelai-anjasmoro", name: "Kedelai Petak Organik", growthStage: "vegetative_growth", plantedAt: now - 55 * day },
  { userIndex: 28, deviceId: "IAFT07", catalogKey: "cabai-rawit", name: "Cabai Rawit Putih", growthStage: "seedling_development", plantedAt: now - 20 * day },
  { userIndex: 29, deviceId: "IAFT08", catalogKey: "kacang-tanah-gajah", name: "Kacang Tanah Kebun", growthStage: "seedling_development", plantedAt: now - 25 * day },
  { userIndex: 30, deviceId: "IAFT09", catalogKey: "bawang-merah-brebes", name: "Bawang Brebes Stasiun", growthStage: "vegetative_growth", plantedAt: now - 42 * day },
  { userIndex: 31, deviceId: "IAFT10", catalogKey: "terong-ungu-panjang", name: "Terong Stasiun", growthStage: "vegetative_growth", plantedAt: now - 38 * day },
  { userIndex: 32, deviceId: "IAFT11", catalogKey: "mentimun-baby", name: "Mentimun Surya", growthStage: "flowering_reproduction", plantedAt: now - 48 * day },
  { userIndex: 33, deviceId: "IAFT12", catalogKey: "kacang-hijau-vima-1", name: "Kacang Hijau Percobaan", growthStage: "seedling_development", plantedAt: now - 16 * day },
  { userIndex: 34, deviceId: "IAFT13", catalogKey: "jagung-manis-bonanza", name: "Jagung Melon House", growthStage: "vegetative_growth", plantedAt: now - 44 * day },
  { userIndex: 35, deviceId: "IAFT14", catalogKey: "kedelai-anjasmoro", name: "Kedelai Tumpang Sari", growthStage: "vegetative_growth", plantedAt: now - 52 * day },
  // ─── Demo account showcase plants ───
  { userIndex: -1, demo: true, deviceId: "IAET01", catalogKey: "selada", name: "Selada Demo Dapur", growthStage: "vegetative_growth", plantedAt: now - 32 * day },
  { userIndex: -1, demo: true, deviceId: "IAET02", catalogKey: "kemangi", name: "Kemangi Demo Ruang Tamu", growthStage: "vegetative_growth", plantedAt: now - 40 * day },
  { userIndex: -1, demo: true, deviceId: "IAFU01", catalogKey: "cabai-rawit", name: "Cabai Demo Lahan", growthStage: "flowering_reproduction", plantedAt: now - 72 * day },
  { userIndex: -1, demo: true, deviceId: "IAFT01", catalogKey: "jagung-manis-bonanza", name: "Jagung Demo Stasiun", growthStage: "vegetative_growth", plantedAt: now - 45 * day },
  { userIndex: -1, demo: true, deviceId: "IAFT02", catalogKey: "kacang-hijau-vima-1", name: "Kacang Demo Surya", growthStage: "vegetative_growth", plantedAt: now - 30 * day },
]

export default seedData
