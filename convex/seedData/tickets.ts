// Seed dataset — hand-maintained. Support tickets with message history.
// Statuses mirror the app lifecycle: open -> in_progress -> resolved -> closed.
interface SeedTicketMessage {
  from: 'user' | 'admin'
  body: string
  dayAgo: number
}

interface SeedTicket {
  userIndex: number
  topic: string
  status: 'open' | 'in_progress' | 'resolved' | 'closed'
  priority: 'low' | 'normal' | 'high' | 'urgent'
  dayAgo: number
  messages: SeedTicketMessage[]
}

const seedData: SeedTicket[] = [
  {
    userIndex: 12,
    topic: "Pod mati total pas mudik",
    status: 'resolved',
    priority: 'high',
    dayAgo: 9,
    messages: [
      { from: 'user', body: "Pod-ku mati total pas mudik 5 dino, tanduran garing. Solusine piye min?", dayAgo: 9 },
      { from: 'admin', body: "Mohon maaf atas kendalanya. Untuk ditinggal lama, sambungkan tandon cadangan minimal 20 liter. Coba isi ulang dan amati 2 hari, biasanya pulih.", dayAgo: 8 },
      { from: 'user', body: "Wis pulih min, matur nuwun! Sesuk tak siapke tandon gede.", dayAgo: 7 },
    ],
  },
  {
    userIndex: 1,
    topic: "Aplikasi ora iso login",
    status: 'resolved',
    priority: 'urgent',
    dayAgo: 12,
    messages: [
      { from: 'user', body: "Aplikasiku ora iso login, tulisane sandi salah terus. Padahal bener. Tulung min.", dayAgo: 12 },
      { from: 'admin', body: "Coba reset sandi lewat tombol lupa sandi, lalu login ulang. Jika masih gagal, kabari kami dengan screenshot.", dayAgo: 12 },
      { from: 'user', body: "Wis iso min! Ternyata caps lock nyala. Haha. Matur nuwun.", dayAgo: 11 },
    ],
  },
  {
    userIndex: 10,
    topic: "Nutrisi telat teko",
    status: 'closed',
    priority: 'normal',
    dayAgo: 20,
    messages: [
      { from: 'user', body: "Nutrisi sing tak pesen seminggu ora teko-teko. No resine ora jalan. Piye min?", dayAgo: 20 },
      { from: 'admin', body: "Kami cek paketnya tertahan di gudang Solo. Sudah kami kirim ulang, estimasi 2 hari sampai.", dayAgo: 19 },
      { from: 'user', body: "Wis teko min, suwun. Tiket e tutup ae.", dayAgo: 17 },
    ],
  },
  {
    userIndex: 15,
    topic: "Sensor tanah macet nang angka 99",
    status: 'in_progress',
    priority: 'high',
    dayAgo: 2,
    messages: [
      { from: 'user', body: "Sensor tanah pod-ku macet nang angka 99 terus, disiram ora mudun-mudun. Rusak ya?", dayAgo: 2 },
      { from: 'admin', body: "Kemungkinan probe berkerak. Cabut, gosok pelan pakai sikat gigi, pasang lagi. Kabari hasilnya ya pak.", dayAgo: 1 },
    ],
  },
  {
    userIndex: 26,
    topic: "Cara ganti password",
    status: 'resolved',
    priority: 'low',
    dayAgo: 15,
    messages: [
      { from: 'user', body: "Bun-bun, eh min, cara ganti password piye? Wedi kelalen.", dayAgo: 15 },
      { from: 'admin', body: "Buka Profil, pilih Keamanan, lalu Ubah Kata Sandi. Ikuti langkahnya sampai selesai.", dayAgo: 15 },
      { from: 'user', body: "Wis iso, gampang jebule. Suwun min.", dayAgo: 14 },
    ],
  },
  {
    userIndex: 17,
    topic: "Panel surya ora ngisi pas mendung",
    status: 'open',
    priority: 'normal',
    dayAgo: 1,
    messages: [
      { from: 'user', body: "Mendung seminggu, baterai mudun terus. Panel e ngisi ora ya? Wedi mati.", dayAgo: 1 },
    ],
  },
  {
    userIndex: 13,
    topic: "Garansi pod berapa lama?",
    status: 'in_progress',
    priority: 'low',
    dayAgo: 3,
    messages: [
      { from: 'user', body: "Min, garansi pod berapa lama ya? Pompaku suarane kasar.", dayAgo: 3 },
      { from: 'admin', body: "Garansi 1 tahun untuk mesin, 3 bulan untuk pompa. Boleh kirim video suara pompanya untuk kami nilai.", dayAgo: 2 },
    ],
  },
  {
    userIndex: 31,
    topic: "Tandon retak, iso ganti sparepart?",
    status: 'open',
    priority: 'normal',
    dayAgo: 0,
    messages: [
      { from: 'user', body: "Lur... eh min, tandonku retak ketekan. Iso tuku gantine tok ora? Eman nek tuku pod anyar.", dayAgo: 0 },
    ],
  },
]

export default seedData
