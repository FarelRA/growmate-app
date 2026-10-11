// Seed dataset — hand-maintained. Marketplace buyer-seller threads.
// Resolved by product title at seed time (see convex/seed/threads.ts).
interface SeedThreadMessage {
  from: 'buyer' | 'seller'
  body: string
  dayAgo: number
}

interface SeedThread {
  productTitle: string
  buyerIndex: number
  messages: SeedThreadMessage[]
}

const seedData: SeedThread[] = [
  {
    productTitle: "Bibit Selada Siap Pindah Tanam",
    buyerIndex: 11,
    messages: [
      { from: 'buyer', body: "Mas, bibite isih ono? Butuh 10 ae.", dayAgo: 3 },
      { from: 'seller', body: "Isih mbak, monggo. Lokasi Sleman kota.", dayAgo: 3 },
      { from: 'buyer', body: "COD Bantul iso? Aku nang Bantul.", dayAgo: 2 },
      { from: 'seller', body: "Iso, ketemuan nang terminal Jombor piye? Sesuk esuk.", dayAgo: 2 },
      { from: 'buyer', body: "Deal mas! Sesuk jam 8 ya. Matur nuwun.", dayAgo: 2 },
    ],
  },
  {
    productTitle: "Stek Mint Wangi, 5 Batang",
    buyerIndex: 13,
    messages: [
      { from: 'buyer', body: "Mbak, stek e wis oyotan tenan?", dayAgo: 5 },
      { from: 'seller', body: "Wis mbak, putih-putih oyote. Tinggal tancep.", dayAgo: 5 },
      { from: 'buyer', body: "Oke, pesen 2 bungkus ya mbak.", dayAgo: 4 },
    ],
  },
  {
    productTitle: "Bayam Petik Pagi Ini, 500 Gram",
    buyerIndex: 19,
    messages: [
      { from: 'buyer', body: "Bun, bayame isih seger? Arep jupuk esuk iki iso?", dayAgo: 1 },
      { from: 'seller', body: "Iso mas, metik jam 6 esuk. Langsung jupuk ae.", dayAgo: 1 },
      { from: 'buyer', body: "Siap bun, jam 7 tak jupuk. Matur nuwun.", dayAgo: 1 },
    ],
  },
  {
    productTitle: "Netpot 5cm Isi 50, Turah Tuku",
    buyerIndex: 29,
    messages: [
      { from: 'buyer', body: "Mas, netpot e isih? Butuh 1 pak ae.", dayAgo: 6 },
      { from: 'seller', body: "Isih mas, monggo. Lokasine pundi?", dayAgo: 6 },
      { from: 'buyer', body: "Aku Bantul mas, COD tengah-tengah iso?", dayAgo: 5 },
      { from: 'seller', body: "Iso, Malioboro piye? Aku yo sering lewat.", dayAgo: 5 },
    ],
  },
  {
    productTitle: "POC Buatanku Dewe, 1 Liter",
    buyerIndex: 16,
    messages: [
      { from: 'buyer', body: "Mas, POC e go pod iso? Takut gosong.", dayAgo: 4 },
      { from: 'seller', body: "Iso mbak, encerke 1:100. Aku dewe nganggo.", dayAgo: 4 },
      { from: 'buyer', body: "Oke mas, pesen 1 liter disik nyoba.", dayAgo: 4 },
      { from: 'seller', body: "Siap, tak kirim sesuk esuk mbak.", dayAgo: 3 },
    ],
  },
  {
    productTitle: "Cocopeat Karungan 5kg",
    buyerIndex: 33,
    messages: [
      { from: 'buyer', body: "Mas, cocopeat e wis dicuci tenan? Soale arep go semai.", dayAgo: 7 },
      { from: 'seller', body: "Wis mas, 3x cuci. Siap pakai.", dayAgo: 7 },
      { from: 'buyer', body: "Oke, jupuk 1 karung. Lokasi Jakal sebelah ndi mas?", dayAgo: 6 },
    ],
  },
  {
    productTitle: "Bibit Cabai Rawit Lokal Magelang",
    buyerIndex: 27,
    messages: [
      { from: 'buyer', body: "Mas, bibite umur piro? Tahan panas ora?", dayAgo: 2 },
      { from: 'seller', body: "3 minggu mas, lokal Magelang tahan panas.", dayAgo: 2 },
      { from: 'buyer', body: "Pesen 20 polibag mas. Kirim opo jupuk?", dayAgo: 2 },
      { from: 'seller', body: "Sak karepmu mas, kirim iso tambah ongkir.", dayAgo: 1 },
    ],
  },
  {
    productTitle: "Panen Kemangi Sekarung?",
    buyerIndex: 30,
    messages: [
      { from: 'buyer', body: "Bun, butuh kemangi akeh go acara hajatan. Iso 5 ikat?", dayAgo: 3 },
      { from: 'seller', body: "Iso bun, metik H-1 ben seger. Kapan acarane?", dayAgo: 3 },
      { from: 'buyer', body: "Minggu bun. Nego dikit iso? Hehe.", dayAgo: 3 },
      { from: 'seller', body: "Iso bun, 10rb per ikat nek 5. Deal?", dayAgo: 2 },
      { from: 'buyer', body: "Deal bun! Matur nuwun.", dayAgo: 2 },
    ],
  },
  {
    productTitle: "Rockwool Slice, Ecer Per Lembar",
    buyerIndex: 32,
    messages: [
      { from: 'buyer', body: "Mbak, tuku 20 lembar iso?", dayAgo: 8 },
      { from: 'seller', body: "Iso mbak, monggo. Lokasi Kulon Progo.", dayAgo: 8 },
    ],
  },
  {
    productTitle: "Jagung Manis Petik Sendiri",
    buyerIndex: 10,
    messages: [
      { from: 'buyer', body: "Seru iki! Petik dewe tenan mas? Lokasine pundi?", dayAgo: 1 },
      { from: 'seller', body: "Tenan mas, nang Bantul. Esuk opo sore penak.", dayAgo: 1 },
      { from: 'buyer', body: "Sesuk esuk tak gas mas. 3 kilo ya.", dayAgo: 1 },
      { from: 'seller', body: "Siap, tak siapke. Ati-ati dalane teles.", dayAgo: 0 },
    ],
  },
]

export default seedData
