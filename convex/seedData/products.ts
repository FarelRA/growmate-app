// Seed dataset — hand-maintained. Image bytes live in public/seed-images/<hash>/;
// this module carries only content hashes (see convex/seed/images.ts).
import type { ProductSeedData } from './types'

const seedData: ProductSeedData[] = [
  {
    title: "GrowMate Pods",
    description:
      "GrowMate Pods adalah perangkat hidroponik indoor otomatis untuk satu tanaman. Dilengkapi sensor kelembaban tanah, sensor cahaya, dan pompa air otomatis dengan kontrol penyiraman serta pencahayaan berbasis threshold. Tanpa modem dan panel surya — cukup sambungkan ke Wi-Fi rumah. Cocok untuk dapur, ruang tamu, dan apartemen.",
    category: "hardware",
    featured: true,
    price: 803000,
    quantityAvailable: 100,
    priceUnit: "IDR",
    shopeeUrl: "https://shopee.co.id/growmate-pods",
    image: { hash: "3e3a2499e0a0bd1a" },
  },
  {
    title: "GrowMate Tech",
    description:
      "GrowMate Tech adalah perangkat lahan outdoor untuk kebun dan sawah. Sensor multi-spektrum, tangki pupuk dan pestisida, dan otomatisasi penuh untuk penyiraman serta pemantauan nutrisi real-time via aplikasi. Ideal untuk cabai, jagung, kacang-kacangan, dan hortikultura pada Musim Tanam Pertama.",
    category: "hardware",
    featured: true,
    price: 2083000,
    quantityAvailable: 100,
    priceUnit: "IDR",
    shopeeUrl: "https://shopee.co.id/growmate-tech",
    image: { hash: "3e3a2499e0a0bd1a" },
  },
  {
    title: "GrowMate Tech Add-on",
    description:
      "GrowMate Tech Add-on adalah varian lapangan lengkap dengan modem seluler dan panel surya terintegrasi plus baterai berkapasitas besar. Tetap online dan menyiram di lahan tanpa listrik maupun Wi-Fi. Pilihan tepat untuk greenhouse desa, kebun surya, dan stasiun irigasi terpencil.",
    category: "hardware",
    featured: true,
    price: 2409000,
    quantityAvailable: 100,
    priceUnit: "IDR",
    shopeeUrl: "https://shopee.co.id/growmate-tech-addon",
    image: { hash: "3e3a2499e0a0bd1a" },
  },
  {
    title: "GrowMate Advance Subscription",
    description:
      "Langganan Advance membuka asisten AI Floral tanpa batas harian, analitik pertumbuhan tanaman, rekomendasi nutrisi personal, riwayat sensor penuh, dan prioritas sinkronisasi perangkat. Ditagih per bulan per akun dan dapat dibatalkan kapan saja.",
    category: "subscription",
    featured: true,
    price: 9000,
    quantityAvailable: 10000,
    priceUnit: "bulan",
    image: { hash: "3e3a2499e0a0bd1a" },
  },
]

export default seedData
