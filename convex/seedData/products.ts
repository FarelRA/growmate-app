// Seed dataset — hand-maintained. Image bytes live in public/seed-images/<hash>/;
// this module carries only content hashes (see convex/seed/images.ts).
import type { ProductSeedData } from './types'

const seedData: ProductSeedData[] = [
  {
    title: "GrowMate v1",
    description: "GrowMate v1 adalah perangkat hidroponik pintar generasi pertama yang dirancang untuk pemula dan hobiis. Dilengkapi sensor kelembaban tanah, sensor cahaya, dan pompa air otomatis. Mendukung kontrol penyiraman dan pencahayaan berbasis threshold. Cocok untuk budidaya sayuran daun dan herba di rumah dengan sistem hidroponik skala kecil hingga menengah.",
    category: "hardware",
    featured: true,
    price: 349000,
    quantityAvailable: 100,
    priceUnit: "IDR",
    shopeeUrl: "https://shopee.co.id/growmate-v1",
    image: { hash: "3e3a2499e0a0bd1a" },
  },
  {
    title: "GrowMate v2",
    description: "GrowMate v2 adalah perangkat hidroponik pintar generasi terbaru dengan peningkatan fitur signifikan. Dilengkapi sensor multi-spektrum, konektivitas Wi-Fi dan seluler, panel surya terintegrasi, serta baterai kapasitas besar. Mendukung kontrol otomatis penuh untuk penyiraman, pencahayaan, dan pemantauan nutrisi secara real-time melalui aplikasi. Ideal untuk greenhouse dan pertanian urban skala menengah hingga besar.",
    category: "hardware",
    featured: true,
    price: 599000,
    quantityAvailable: 100,
    priceUnit: "IDR",
    shopeeUrl: "https://shopee.co.id/growmate-v2",
    image: { hash: "3e3a2499e0a0bd1a" },
  },
]

export default seedData
