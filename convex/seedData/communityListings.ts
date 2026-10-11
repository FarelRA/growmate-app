// Seed dataset — hand-maintained. Image bytes live in public/seed-images/<hash>/;
// this module carries only content hashes (see convex/seed/images.ts).
// (Listing photos are a deferred fix: all share one placeholder for now.)
import type { SeedImage } from './types'

// Image bytes live in public/seed-images/3e3a2499e0a0bd1a/ — this module carries only the hash.
const SHARED_COMMUNITY_IMAGE: SeedImage = { hash: "3e3a2499e0a0bd1a" }

interface SeedCommunityListing {
  sellerIndex: number
  title: string
  description: string
  price: number
  category: string
  quantityAvailable: number
  priceUnit: string
  locationLabel: string
  contactPreference: 'chat' | 'pickup' | 'delivery'
  image: SeedImage
}

const seedData: SeedCommunityListing[] = [
  {
    sellerIndex: 0,
    title: "Bibit Selada Siap Pindah Tanam",
    description: "Bibit selada umur 14 hari, akar wis kuat. Siap pindah netpot. Stok 20 bibit, sing serius monggo chat. Lokasi Sleman kota.",
    price: 15000,
    category: "seedling",
    quantityAvailable: 20,
    priceUnit: "IDR",
    locationLabel: "Sleman",
    contactPreference: "chat",
    image: SHARED_COMMUNITY_IMAGE,
  },
  {
    sellerIndex: 3,
    title: "Stek Mint Wangi, 5 Batang",
    description: "Stek batang mint seger, gampang urip. Per bungkus isi 5 stek. Iso go teh opo lalapan. Wis metu oyote.",
    price: 10000,
    category: "cutting",
    quantityAvailable: 15,
    priceUnit: "IDR",
    locationLabel: "Sleman",
    contactPreference: "chat",
    image: SHARED_COMMUNITY_IMAGE,
  },
  {
    sellerIndex: 5,
    title: "Bayam Petik Pagi Ini, 500 Gram",
    description: "Bayam metik esuk iki, seger tenan. Tanpa pestisida, soko pod dewe. Rego per 500 gram. Sore dikit layu, ndang sat set!",
    price: 8000,
    category: "harvest",
    quantityAvailable: 10,
    priceUnit: "IDR",
    locationLabel: "Bantul",
    contactPreference: "pickup",
    image: SHARED_COMMUNITY_IMAGE,
  },
  {
    sellerIndex: 7,
    title: "Netpot 5cm Isi 50, Turah Tuku",
    description: "Netpot 5cm turah tuku kebanyakan. Isi 50 pcs, isih anyar plastikan. Rego pasaran 30rb, tak dol 25rb ae.",
    price: 25000,
    category: "supplies",
    quantityAvailable: 2,
    priceUnit: "IDR",
    locationLabel: "Yogyakarta",
    contactPreference: "chat",
    image: SHARED_COMMUNITY_IMAGE,
  },
  {
    sellerIndex: 10,
    title: "POC Buatanku Dewe, 1 Liter",
    description: "Pupuk organik cair gaweanku dewe soko sampah dapur + EM4. Wis tak coba nang pod, tanduran subur. 1 liter cukup suwe.",
    price: 35000,
    category: "supplies",
    quantityAvailable: 8,
    priceUnit: "IDR",
    locationLabel: "Solo",
    contactPreference: "delivery",
    image: SHARED_COMMUNITY_IMAGE,
  },
  {
    sellerIndex: 2,
    title: "Cocopeat Karungan 5kg",
    description: "Cocopeat halus wis dicuci, siap pakai go media semai opo campuran pot. Karungan 5kg. Lokasi Jakal, iso COD.",
    price: 25000,
    category: "supplies",
    quantityAvailable: 12,
    priceUnit: "IDR",
    locationLabel: "Sleman",
    contactPreference: "pickup",
    image: SHARED_COMMUNITY_IMAGE,
  },
  {
    sellerIndex: 12,
    title: "Bibit Cabai Rawit Lokal Magelang",
    description: "Bibit cabai rawit umur 3 minggu, godonge ijo royo-royo. Varietas lokal tahan panas. Stok akeh, rego per polibag.",
    price: 5000,
    category: "seedling",
    quantityAvailable: 50,
    priceUnit: "IDR",
    locationLabel: "Magelang",
    contactPreference: "chat",
    image: SHARED_COMMUNITY_IMAGE,
  },
  {
    sellerIndex: 16,
    title: "Panen Kemangi Sekarung?",
    description: "Kemangiku lebat poll, dipetiki ora entek-entek. Sopo sing butuh akeh go acara opo warung, monggo. Rego per ikat, iso nego.",
    price: 12000,
    category: "harvest",
    quantityAvailable: 20,
    priceUnit: "IDR",
    locationLabel: "Sleman",
    contactPreference: "chat",
    image: SHARED_COMMUNITY_IMAGE,
  },
  {
    sellerIndex: 21,
    title: "Rockwool Slice, Ecer Per Lembar",
    description: "Rockwool slice turah proyek hidroponik. Diedol ecer per lembar, cocok go pemula sing arep nyoba. Lokasi Kulon Progo.",
    price: 2000,
    category: "supplies",
    quantityAvailable: 100,
    priceUnit: "IDR",
    locationLabel: "Kulon Progo",
    contactPreference: "pickup",
    image: SHARED_COMMUNITY_IMAGE,
  },
  {
    sellerIndex: 24,
    title: "Jagung Manis Petik Sendiri",
    description: "Jagung manis nang lahanku wis tuwo, iso petik dewe nang lahan. Sensasine bedo! Per kilo 12rb, petik dewe. Lokasi Bantul.",
    price: 12000,
    category: "harvest",
    quantityAvailable: 30,
    priceUnit: "IDR",
    locationLabel: "Bantul",
    contactPreference: "pickup",
    image: SHARED_COMMUNITY_IMAGE,
  },
  {
    sellerIndex: 29,
    title: "Benih Kangkung Bangkok, Bungkus Cilik",
    description: "Benih kangkung Bangkok bungkus cilik, cukup go 2 bedeng pod. Daya tukul apik, wis tak coba dewe. Expire isih suwe.",
    price: 10000,
    category: "seedling",
    quantityAvailable: 25,
    priceUnit: "IDR",
    locationLabel: "Bantul",
    contactPreference: "delivery",
    image: SHARED_COMMUNITY_IMAGE,
  },
  {
    sellerIndex: 31,
    title: "Stroberi Petik 250 Gram",
    description: "Stroberi metik esuk iki, manis. Per mika 250 gram. Stok terbatas, sopo cepet dheweke entuk. Lokasi Gunungkidul.",
    price: 20000,
    category: "harvest",
    quantityAvailable: 6,
    priceUnit: "IDR",
    locationLabel: "Gunungkidul",
    contactPreference: "chat",
    image: SHARED_COMMUNITY_IMAGE,
  },
  {
    sellerIndex: 33,
    title: "Sekam Bakar Karung 10kg",
    description: "Sekam bakar mateng, ireng merata, ora mambu. Go campuran media pot opo mulsa. Karung 10kg, abot tapi worth it.",
    price: 18000,
    category: "supplies",
    quantityAvailable: 10,
    priceUnit: "IDR",
    locationLabel: "Wonosari",
    contactPreference: "pickup",
    image: SHARED_COMMUNITY_IMAGE,
  },
  {
    sellerIndex: 34,
    title: "Tomat Ceri Campur, Sekilo",
    description: "Tomat ceri campur abang kuning, metik esuk. Manis-manis. Cocok go salad opo cemilan anak. Per kilo ya, bukan per mika.",
    price: 30000,
    category: "harvest",
    quantityAvailable: 8,
    priceUnit: "IDR",
    locationLabel: "Sleman",
    contactPreference: "delivery",
    image: SHARED_COMMUNITY_IMAGE,
  },
]

export default seedData
