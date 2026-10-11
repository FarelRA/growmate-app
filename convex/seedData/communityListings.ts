// Seed dataset — hand-maintained. Image bytes live in public/seed-images/<hash>/;
// this module carries only content hashes (see convex/seed/images.ts).
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
    title: "Bibit Selada Hidroponik Siap Tanam",
    description: "Bibit selada hijau organik siap tanam untuk sistem hidroponik. Umur 14 hari setelah semai, akar sudah kuat dan siap dipindah ke netpot. Tersedia 20 bibit.",
    price: 15000,
    category: "seedling",
    quantityAvailable: 20,
    priceUnit: "IDR",
    locationLabel: "Surabaya",
    contactPreference: "chat",
    image: SHARED_COMMUNITY_IMAGE,
  },
  {
    sellerIndex: 3,
    title: "Stek Tanaman Mint Wangi",
    description: "Stek batang mint segar siap tanam. Mudah berakar dalam air atau media tanam. Cocok untuk teman minuman atau lalapan. Per bungkus isi 5 stek.",
    price: 10000,
    category: "cutting",
    quantityAvailable: 15,
    priceUnit: "IDR",
    locationLabel: "Malang",
    contactPreference: "chat",
    image: SHARED_COMMUNITY_IMAGE,
  },
  {
    sellerIndex: 5,
    title: "Panen Bayam Segar 500gr",
    description: "Bayam hijau segar hasil panen hidroponik hari ini. Bebas pestisida, kaya zat besi. Langsung dari kebun ke meja makan. Harga per 500 gram.",
    price: 8000,
    category: "harvest",
    quantityAvailable: 10,
    priceUnit: "IDR",
    locationLabel: "Semarang",
    contactPreference: "pickup",
    image: SHARED_COMMUNITY_IMAGE,
  },
  {
    sellerIndex: 7,
    title: "Netpot Hidroponik 5cm (50 pcs)",
    description: "Netpot ukuran diameter 5cm untuk sistem hidroponik. Cocok untuk netpot sayuran daun, herba, dan strawberry. Bahan plastik keras berkualitas. Harga per pak 50 pcs.",
    price: 25000,
    category: "tool",
    quantityAvailable: 30,
    priceUnit: "IDR",
    locationLabel: "Jakarta",
    contactPreference: "delivery",
    image: SHARED_COMMUNITY_IMAGE,
  },
  {
    sellerIndex: 10,
    title: "Pupuk Organik Cair POC 1 Liter",
    description: "Pupuk organik cair dari fermentasi limbah dapur dan tumbuhan. Mengandung mikroorganisme baik untuk tanaman. Cukup untuk 50 liter larutan. 1 botol ukuran 1 liter.",
    price: 35000,
    category: "nutrient",
    quantityAvailable: 25,
    priceUnit: "IDR",
    locationLabel: "Medan",
    contactPreference: "chat",
    image: SHARED_COMMUNITY_IMAGE,
  },
  {
    sellerIndex: 2,
    title: "Cocopeat Premium 5kg",
    description: "Cocopeat atau sabut kelapa halus siap pakai untuk media tanam. pH netral, daya serap air tinggi. Sudah dicuci dan dikeringkan. Kemasan 5 kg press.",
    price: 45000,
    category: "growing-medium",
    quantityAvailable: 10,
    priceUnit: "IDR",
    locationLabel: "Bandung",
    contactPreference: "delivery",
    image: SHARED_COMMUNITY_IMAGE,
  },
  {
    sellerIndex: 14,
    title: "Sekam Bakar Mentah 10kg",
    description: "Media tanam sekam bakar untuk campuran tanah atau media hidroponik. Ringan, porous, dan steril. Kemasan karung 10 kg.",
    price: 20000,
    category: "growing-medium",
    quantityAvailable: 8,
    priceUnit: "IDR",
    locationLabel: "Depok",
    contactPreference: "pickup",
    image: SHARED_COMMUNITY_IMAGE,
  },
  {
    sellerIndex: 8,
    title: "Bibit Pakcoy Organik 50 Benih",
    description: "Benih pakcoy putih varietas unggul, daya kecambah tinggi. Cocok untuk hidroponik dan polybag. Dikemas dalam pouch kedap udara. Isi 50 butir benih.",
    price: 12000,
    category: "seedling",
    quantityAvailable: 40,
    priceUnit: "IDR",
    locationLabel: "Solo",
    contactPreference: "chat",
    image: SHARED_COMMUNITY_IMAGE,
  },
  {
    sellerIndex: 19,
    title: "Panen Tomat Ceri Merah 250gr",
    description: "Tomat ceri merah manis hasil panen hari ini. Rasa manis segar, cocok untuk camilan atau campuran salad. Dijual per 250 gram.",
    price: 15000,
    category: "harvest",
    quantityAvailable: 5,
    priceUnit: "IDR",
    locationLabel: "Yogyakarta",
    contactPreference: "pickup",
    image: SHARED_COMMUNITY_IMAGE,
  },
  {
    sellerIndex: 12,
    title: "Pipa PVC Hidroponik 2,5inch 1m",
    description: "Pipa PVC 2,5 inci untuk instalasi hidroponik sistem DFT atau NFT. Sudah dilubangi dengan jarak 20cm. Panjang 1 meter, diameter 2,5 inci.",
    price: 50000,
    category: "tool",
    quantityAvailable: 20,
    priceUnit: "IDR",
    locationLabel: "Tangerang",
    contactPreference: "delivery",
    image: SHARED_COMMUNITY_IMAGE,
  },
  {
    sellerIndex: 1,
    title: "Tanaman Hias Monstera Muda",
    description: "Anakan monstera deliciosa berdaun 3-4 helai. Cocok untuk dekorasi ruangan dan taman. Sudah berakar dan siap tanam dalam pot.",
    price: 35000,
    category: "decor",
    quantityAvailable: 5,
    priceUnit: "IDR",
    locationLabel: "Yogyakarta",
    contactPreference: "pickup",
    image: SHARED_COMMUNITY_IMAGE,
  },
  {
    sellerIndex: 16,
    title: "Stek Sirih Gading Varigata",
    description: "Stek batang sirih gading varigata dengan 2-3 ruas. Daun motif loreng hijau putih, cocok untuk tanaman gantung atau dekorasi dinding.",
    price: 7000,
    category: "cutting",
    quantityAvailable: 25,
    priceUnit: "IDR",
    locationLabel: "Denpasar",
    contactPreference: "chat",
    image: SHARED_COMMUNITY_IMAGE,
  },
  {
    sellerIndex: 6,
    title: "Nutrisi AB Mix 200ml",
    description: "Nutrisi hidroponik AB Mix konsentrat untuk sayuran daun. Cukup untuk 200 liter larutan nutrisi. Botol kemasan 200ml siap pakai.",
    price: 18000,
    category: "nutrient",
    quantityAvailable: 20,
    priceUnit: "IDR",
    locationLabel: "Bogor",
    contactPreference: "delivery",
    image: SHARED_COMMUNITY_IMAGE,
  },
  {
    sellerIndex: 18,
    title: "Bibit Cabai Rawit 30 Benih",
    description: "Benih cabai rawit lokal pedas super. Daya tumbuh tinggi, cocok untuk polybag dan hidroponik. Hasil panen melimpah. Isi 30 butir benih per pouch.",
    price: 10000,
    category: "seedling",
    quantityAvailable: 35,
    priceUnit: "IDR",
    locationLabel: "Bogor",
    contactPreference: "chat",
    image: SHARED_COMMUNITY_IMAGE,
  },
]

export default seedData
