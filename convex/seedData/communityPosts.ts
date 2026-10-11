// Seed dataset — hand-maintained. Image bytes live in public/seed-images/<hash>/;
// posts carry no images for now; comments and likes are explicit per post.
import type { SeedImage } from './types'

interface SeedPostComment {
  userIndex: number
  body: string
}

interface SeedCommunityPost {
  userIndex: number
  title: string
  body: string
  image?: SeedImage
  comments: SeedPostComment[]
  likes: number[]
}

const seedData: SeedCommunityPost[] = [
  // ─── Budi Santoso (Sleman, 3 posts) ───
  {
    userIndex: 0,
    title: "Panen selada pertama, seger tenan lur!",
    body: "Alhamdulillah lur, selada pod pertama panen. Umur sebulan, godonge lebar-lebar. Langsung digawe lalap pecel. Rasane seger, bedo karo tuku pasar. Sing durung panen sabar ya!",
    comments: [
      { userIndex: 1, body: "Wah selamat mas! Punyaku seminggu lagi kayane." },
      { userIndex: 5, body: "Jos mas Budi! Lalap pecel paling pas." },
      { userIndex: 22, body: "Mantap lur, ijo-ijone apik." },
    ],
    likes: [1, 5, 22, 3, 15],
  },
  {
    userIndex: 0,
    title: "Kemangi pod-ku wis rimbun",
    body: "Lur, kemangiku wis rimbun poll. Saben masak tinggal petik. Wangine tekan ruang tamu. Nandur dewe pancen marem.",
    comments: [
      { userIndex: 4, body: "Marem tenan mas. Punyaku juga, buat teh enak." },
      { userIndex: 13, body: "Wangi ya mas, punyaku juga gitu." },
    ],
    likes: [4, 13, 1],
  },
  {
    userIndex: 0,
    title: "Absen pod ruang tamu, ijo-ijo",
    body: "Absen lur, pod nang ruang tamu wis ijo kabeh. Tamu pada kaget dikira plastik. Sing nandur nang njero omah pamer sini!",
    comments: [
      { userIndex: 14, body: "Haha podo mas, mertuaku ngira plastik." },
      { userIndex: 29, body: "Apik mas! Punyaku nang teras." },
      { userIndex: 35, body: "Absen! Punyaku nang kamar, adem." },
    ],
    likes: [14, 29, 35, 3],
  },
  // ─── Sri Wahyuni (Bantul, 2 posts) ───
  {
    userIndex: 1,
    title: "Baru gabung, salam kenal semuanya",
    body: "Halo, aku ibu-ibu dari Bantul, baru beli pod minggu lalu. Isine selada karo kemangi. Mohon bimbingannya ya semuanya.",
    comments: [
      { userIndex: 0, body: "Salam kenal mbak Sri! Gampang kok, sing penting rutin." },
      { userIndex: 7, body: "Halo mbak, aku juga Bantul. Semangat!" },
      { userIndex: 19, body: "Sugeng rawuh mbak, ayo sinau bareng." },
      { userIndex: 33, body: "Salam kenal mbak Sri!" },
    ],
    likes: [0, 7, 19, 33, 5],
  },
  {
    userIndex: 1,
    title: "Bayamku bolong-bolong, kenapa ya?",
    body: "Bun, bayamku godonge bolong-bolong cilik. Tak goleki ulere ora ketemu. Kira-kira kenapa ya? Soale buat dimakan anak, wedi nek kenapa-kenapa.",
    comments: [
      { userIndex: 13, body: "Biasane serangga malam mbak, coba dicek bengi pakai senter." },
      { userIndex: 27, body: "Coba disemprot banyu bawang mbak, aman." },
      { userIndex: 5, body: "Punyaku pernah ngono, ilang dewe kok bun." },
    ],
    likes: [13, 27, 5],
  },
  // ─── Agus Prasetyo (Yogyakarta, 2 posts) ───
  {
    userIndex: 2,
    title: "Lahan cabai wis mulai kembang lur",
    body: "Alhamdulillah lur, cabai nang lahanku wis kembang-kembang. Umur 2,5 sasi. Mugo-mugo dadi buah kabeh. Doakan ya!",
    comments: [
      { userIndex: 16, body: "Aamiin mas! Semoga panene melimpah." },
      { userIndex: 10, body: "Mantap mas Agus, update terus ya." },
      { userIndex: 25, body: "Jos! Punyaku baru tunas." },
      { userIndex: 30, body: "Semoga regane apik pas panen mas." },
    ],
    likes: [16, 10, 25, 30, 8],
  },
  {
    userIndex: 2,
    title: "Udan mulai ora karuan, siap-siap rendeng",
    body: "Lur, udan wis mulai teko. Lahanku bekas jagung, rencana arep cabai. Sing podo siap-siap rendeng absen! Mugo-mugo udane cukup ora kebanjiran.",
    comments: [
      { userIndex: 17, body: "Absen mas! Punyaku wis dibalik lemahe." },
      { userIndex: 24, body: "Siap mas, kacangku wis panen, genti cabai." },
      { userIndex: 6, body: "Mugo-mugo lancar kabeh lur." },
    ],
    likes: [17, 24, 6],
  },
  // ─── Dewi Sartika (Sleman, 3 posts) ───
  {
    userIndex: 3,
    title: "Stroberiku berbuah! Seneng poll",
    body: "Guys, stroberiku akhirnya berbuah! Nunggu 2 sasi. Cilike lucu, abang-abang. Anakku sing paling seneng, rebutan. Semangat buat yang nanam stroberi!",
    comments: [
      { userIndex: 7, body: "Wah selamat mbak! Punyaku masih bunga." },
      { userIndex: 31, body: "Lucu ya mbak, pengen juga." },
      { userIndex: 18, body: "Manis ora mbak?" },
      { userIndex: 3, body: "Manis mbak, seger!" },
    ],
    likes: [7, 31, 18, 1],
  },
  {
    userIndex: 3,
    title: "Masak sup dari pod sendiri",
    body: "Hari ini masak sup isine pakcoy karo wortel... eh wortel tuku ding, hehe. Tapi pakcoyne metik dewe. Rasane bedo, luwih seger. Masak dari kebun sendiri tuh puas.",
    comments: [
      { userIndex: 9, body: "Haha jujur mbak. Pakcoy sendiri emang manis." },
      { userIndex: 1, body: "Setuju mbak, marem tenan." },
    ],
    likes: [9, 1],
  },
  {
    userIndex: 3,
    title: "Rak pod-ku wis penuh ijo-ijo",
    body: "Pamer dikit, rak pod nang ruang tamu wis penuh. Selada, kemangi, mint. Tamu pada takon iki tanduran tenan opo plastik. Bangga poll!",
    comments: [
      { userIndex: 29, body: "Apik mbak! Rapi tenan." },
      { userIndex: 14, body: "Podoku juga dikira plastik, haha." },
      { userIndex: 35, body: "Ijo-ijo adem ya mbak." },
    ],
    likes: [29, 14, 35, 7],
  },
  // ─── Hendra Gunawan (Klaten, 2 posts) ───
  {
    userIndex: 4,
    title: "Mint-ku tukule ngawur, haha",
    body: "Lur, mint-ku kok tukule ngawur, nganti nutupi selada sebelah. Wangi sih, tapi kasian seladane. Tak pangkas ae apa piye? Eman nek dibuang.",
    comments: [
      { userIndex: 0, body: "Mint pancen ngono mas, haha. Pisah ae." },
      { userIndex: 28, body: "Dipangkas mas, digawe teh enak." },
    ],
    likes: [0, 28],
  },
  {
    userIndex: 4,
    title: "Sore-sore nyiram pod, adem",
    body: "Kegiatan favorit saiki: sore nyiram pod karo ngopi. Ndelok ijo-ijo, pikiran adem. Umur semene butuh hiburan murah, haha.",
    comments: [
      { userIndex: 6, body: "Podoku juga hiburan pak, setuju!" },
      { userIndex: 21, body: "Ngopi + kebun = kombinasi pas." },
      { userIndex: 32, body: "Haha bener pak, murah meriah." },
    ],
    likes: [6, 21, 32],
  },
  // ─── Rina Kusuma (Bantul, 3 posts) ───
  {
    userIndex: 5,
    title: "Romaine vs selada biasa, aku tim romaine",
    body: "Bun, aku nanam 2 jenis. Romaine luwih manis menurutku, cocok buat burger anak. Sing biasa luwih cepet panen. Kalian tim mana?",
    comments: [
      { userIndex: 1, body: "Tim romaine juga bun! Buat kebab enak." },
      { userIndex: 11, body: "Aku tim biasa, ora sabaran nunggu, haha." },
      { userIndex: 19, body: "Romaine menang rasa, biasa menang cepet." },
    ],
    likes: [1, 11, 19],
  },
  {
    userIndex: 5,
    title: "Tips biar nutrisi awet (versi ibu-ibu)",
    body: "Sharing bun, ben nutrisi ora boros: takaran dikit-dikit ae, tandon ditutup ben ora nguap. Aku sebulan mung entek sak botol cilik. Lumayan hemat!",
    comments: [
      { userIndex: 7, body: "Wah hemat tenan mbak, tak tiru." },
      { userIndex: 33, body: "Punyaku boros, jebule tandon kebuka. Makasih tipsnya!" },
      { userIndex: 1, body: "Noted bun!" },
      { userIndex: 26, body: "Ibu-ibu memang paling pinter ngirit, haha." },
    ],
    likes: [7, 33, 1, 26],
  },
  {
    userIndex: 5,
    title: "Anakku doyan sayur gara-gara pod",
    body: "Cerita bun, anakku sing maune ogah sayur, saiki malah rebutan metik selada dewe. Jare metik dewe luwih enak. Buat yang anak e susah sayur, coba ajak nanam!",
    comments: [
      { userIndex: 19, body: "Bener bun! Anakku juga gitu." },
      { userIndex: 31, body: "Setuju, praktek langsung paling ngaruh." },
    ],
    likes: [19, 31, 1, 7],
  },
  // ─── Eko Purnomo (Gunungkidul, 2 posts) ───
  {
    userIndex: 6,
    title: "Kemangi Thailand wangine poll",
    body: "Lur, kemangi Thailand-ku wangine nyegrak tenan. Godonge cilik-cilik tapi aromane kuat. Buat lalapan enak juga. Ono sing nandur juga?",
    comments: [
      { userIndex: 4, body: "Aku mas, buat kari enak." },
      { userIndex: 20, body: "Thailand tahan panas mas, punyaku seger terus." },
    ],
    likes: [4, 20],
  },
  {
    userIndex: 6,
    title: "Mati lampu, pod-ku lemes tapi pulih!",
    body: "Cerita lur, wingi mati lampu suwe nang desaku. Pod lemes kabeh, aku panik. Jebule sesuk e seger meneh 70%. Alhamdulillah, tanduran ki kuat ternyata.",
    comments: [
      { userIndex: 0, body: "Syukur mas! Tanduran pancen tangguh." },
      { userIndex: 15, body: "Untung pulih mas, rejeki." },
      { userIndex: 29, body: "Aku tau ngono juga, pulih kok." },
    ],
    likes: [0, 15, 29],
  },
  // ─── Maya Anggraini (Yogyakarta, 2 posts) ───
  {
    userIndex: 7,
    title: "Stroberiku masih bunga-bunga, sabar",
    body: "Mbak Dewi, stroberiku isih bunga terus, durung dadi buah. Tapi rapopo, bungane ayu didelok. Sabar, rejeki ora kemana. Hehe.",
    comments: [
      { userIndex: 3, body: "Sabar mbak, punyaku juga suwe. Nanti juga berbuah." },
      { userIndex: 31, body: "Bungane ayu tenan mbak, dinikmati ae." },
    ],
    likes: [3, 31],
  },
  {
    userIndex: 7,
    title: "Pod kos jadi pojok favorit",
    body: "Pod nang kosku dadi pojok favorit. Pulang kerja liat ijo-ijo rasane adem. Ono sing podo? Tanduran ki terapi murah.",
    comments: [
      { userIndex: 35, body: "Podo mbak! Ndelok tunas baru nagih." },
      { userIndex: 14, body: "Setuju, ngajarin sabar juga." },
      { userIndex: 1, body: "Iya mbak, apalagi pas panen." },
    ],
    likes: [35, 14, 1],
  },
  // ─── Adi Nugroho (Sleman, 2 posts) ───
  {
    userIndex: 8,
    title: "Bayam dipetiki kok tukul terus, jos!",
    body: "Lur, bayamku tak petiki godonge tok ora tak cabut. Jebule tukul terus, wis panen 3x! Ngirit bibit. Ono sing ngono juga?",
    comments: [
      { userIndex: 18, body: "Aku mas! Iso 4-5x panen." },
      { userIndex: 27, body: "Jos mas, tak tiru carane." },
    ],
    likes: [18, 27],
  },
  {
    userIndex: 8,
    title: "Kabel pod digigit tikus, ati-ati lur",
    body: "Lur ati-ati, kabel pod-ku digigit tikus wingi. Untung mung kabel cilik, tak sambung normal meneh. Pod nang teras rawan tikus ternyata.",
    comments: [
      { userIndex: 2, body: "Wah, dibungkus mas kabel e ben aman." },
      { userIndex: 16, body: "Kasih kamper mas sekitar pod." },
      { userIndex: 24, body: "Aku kabel tak lewatkan paralon, aman." },
    ],
    likes: [2, 16, 24],
  },
  // ─── Fitri Handayani (Kulon Progo, 3 posts) ───
  {
    userIndex: 9,
    title: "Pakcoy panen, langsung dimasak lodeh",
    body: "Alhamdulillah bun, panen 8 bonggol pakcoy. Langsung dimasak lodeh, suami sampai nambah. Katanya manis beda sama beli pasar. Seneng poll masak dari kebun sendiri!",
    comments: [
      { userIndex: 1, body: "MasyaAllah bun, lodeh pakcoy seger ya." },
      { userIndex: 19, body: "Nambah itu pujian tertinggi bun, haha." },
      { userIndex: 33, body: "Umur panen berapa bun?" },
      { userIndex: 9, body: "Sebulan bun, cepet kok." },
    ],
    likes: [1, 19, 33, 5],
  },
  {
    userIndex: 9,
    title: "Netpot ijo-ijo lumut, normal ora bun?",
    body: "Bun, netpotku ijo lumut semua. Tandanamane sih sehat-sehat ae. Risih ae delokne. Dicuci opo didiemke ae ya?",
    comments: [
      { userIndex: 0, body: "Disikat ae mbak pakai sikat gigi bekas, rontok kok." },
      { userIndex: 26, body: "Normal mbak, tandane kena cahaya. Tutup ae." },
    ],
    likes: [0, 26],
  },
  {
    userIndex: 9,
    title: "Mie ayam pakai sawi sendiri",
    body: "Bun, mie ayamku saiki sawinge metik dewe nang pod. Anak-anak pada seneng, jare seger. Emak-emak wajib coba!",
    comments: [
      { userIndex: 5, body: "Wah mantap bun, sawi sendiri memang beda." },
      { userIndex: 11, body: "Jadi pengen juga bun." },
    ],
    likes: [5, 11],
  },
  // ─── Reza Fahlevi (Solo, 2 posts) ───
  {
    userIndex: 10,
    title: "Pod nang kos sempit, ternyata muat!",
    body: "Lur, aku anak kos kamar 3x4. Awalnya ragu muat ora, jebule muat nang pojok. Nandur cabai rawit ben ora tuku terus. Listrik yo aman, cilik kok.",
    comments: [
      { userIndex: 8, body: "Mantap mas, pod memang buat kos-kosan." },
      { userIndex: 29, body: "Aku juga anak kos mas, wis 4 sasi jalan." },
      { userIndex: 2, body: "Cabai rawit cocok mas, awet." },
    ],
    likes: [8, 29, 2],
  },
  {
    userIndex: 10,
    title: "Cabai rawitku kok kriting godonge?",
    body: "Lur, cabai rawit pod-ku godonge kriting. Tak goleki kutu ora ono. Pod nang balkon, awan panas poll. Opo kepanasan ya? Ono sing tau?",
    comments: [
      { userIndex: 24, body: "Coba teduhke dikit mas, balkon panas tenan." },
      { userIndex: 16, body: "Goyangke godong nang kertas putih mas, sopo ngerti ono kewan cilik." },
      { userIndex: 3, body: "Kasih naungan separuh mas." },
    ],
    likes: [24, 16, 3],
  },
  // ─── Intan Permatasari (Bantul, 3 posts) ───
  {
    userIndex: 11,
    title: "Tim butterhead, manis!",
    body: "Bun, aku tim butterhead. Manis lembut, anakku doyan. Sing keriting rodok pait menurutku. Kalian tim mana?",
    comments: [
      { userIndex: 5, body: "Tim butterhead juga bun!" },
      { userIndex: 7, body: "Anakku juga suka butterhead." },
    ],
    likes: [5, 7],
  },
  {
    userIndex: 11,
    title: "Rockwool larang, ganti opo ya bun?",
    body: "Bun, rockwool kok larang ya neng kene. Ono sing nganggo pengganti? Takut gagal nek ganti-ganti.",
    comments: [
      { userIndex: 12, body: "Busa iso mbak, dicuci resik disik." },
      { userIndex: 0, body: "Cocopeat campur sekam juga iso mbak." },
      { userIndex: 21, body: "Aku nganggo busa, hasile podo ae." },
    ],
    likes: [12, 0, 21],
  },
  {
    userIndex: 11,
    title: "Tiap minggu semai, panen ora leren",
    body: "Tips bun: aku tiap minggu semai 4 netpot, dadine tiap minggu ono sing panen. Ora banjir ora kekosongan. Wis 3 sasi dapur ora tau tuku selada!",
    comments: [
      { userIndex: 1, body: "Pinter bun! Tak tiru." },
      { userIndex: 33, body: "Noted mbak, 4 netpot seminggu." },
      { userIndex: 5, body: "Sistem estafet ya bun, mantap." },
    ],
    likes: [1, 33, 5, 19],
  },
  // ─── Dwi Cahyo (Sleman, 2 posts) ───
  {
    userIndex: 12,
    title: "Bayam abang tukule suwe ya?",
    body: "Lur, bayam abangku kok suwe gede ne dibanding bayam ijo? Umur podo. Pancen ngono apa gonku sing salah? Warnane sih apik.",
    comments: [
      { userIndex: 8, body: "Pancen luwih suwe mas, sabar ae." },
      { userIndex: 20, body: "Abang butuh cahaya luwih mas." },
    ],
    likes: [8, 20],
  },
  {
    userIndex: 12,
    title: "Ditinggal mudik, pod-ku garing!",
    body: "Lur, mudik 5 dino pod-ku garing, tandone entek. Ono trik ben awet pas ditinggal? Kapok rasane.",
    comments: [
      { userIndex: 2, body: "Sambung tandon gede mas, galon 19 liter cukup." },
      { userIndex: 15, body: "Titip tonggo mas, haha. Tapi tandon gede solusi." },
      { userIndex: 26, body: "Kran tetes mas, awet." },
    ],
    likes: [2, 15, 26],
  },
  // ─── Nina Zahra (Yogyakarta, 2 posts) ───
  {
    userIndex: 13,
    title: "Teh kemangi + madu, seger!",
    body: "Guys, iseng nyoba godong kemangi diseduh + madu. Seger poll, weteng yo penak. Ono sing tau? Godong mint jare iso juga.",
    comments: [
      { userIndex: 4, body: "Mint + es favoritku mbak, segeer." },
      { userIndex: 28, body: "Kemangi lemon paling wangi mbak." },
      { userIndex: 1, body: "Wah tak coba sesuk, makasih idenya!" },
    ],
    likes: [4, 28, 1],
  },
  {
    userIndex: 13,
    title: "Putih-putih nang batang kemangi, opo iki?",
    body: "Pagi, batang kemangiku ono putih-putih koyo kapas. Godong mulai kriting. Iki opo ya? Cara ngilangke sing aman piye? Pod nang njero omah.",
    comments: [
      { userIndex: 27, body: "Kutu putih mbak, semprot banyu sabun + bawang." },
      { userIndex: 3, body: "Diresiki manual disik mbak, terus semprot." },
      { userIndex: 9, body: "Dipisah mbak, nular cepet." },
    ],
    likes: [27, 3, 9],
  },
  // ─── Ari Wibowo (Magelang, 2 posts) ───
  {
    userIndex: 14,
    title: "Seladaku kok pait ya lur?",
    body: "Lur, aku nang Magelang. Seladaku kok pait? Umur 35 dino. Jare kancaku kepanasan. Bener ora? Panen luwih awal ae ya?",
    comments: [
      { userIndex: 2, body: "Bener mas, panen 28-30 dino ae." },
      { userIndex: 11, body: "Ganti butterhead mas, luwih manis." },
      { userIndex: 30, body: "Teduhke paranet mas." },
    ],
    likes: [2, 11, 30],
  },
  {
    userIndex: 14,
    title: "Barter bibit Magelang-Jogja, monggo!",
    body: "Lur, aku duwe bibit cabai turah akeh. Barter karo tomat opo selada monggo. COD Jogja-Magelang iso. Inbox ae.",
    comments: [
      { userIndex: 10, body: "Gelem mas! Aku duwe tomat turah. Tak inbox." },
      { userIndex: 23, body: "Adoh mas, nek pas lewat tak kabari." },
    ],
    likes: [10, 23],
  },
  // ─── Joko Susilo (Klaten, 2 posts) ───
  {
    userIndex: 15,
    title: "Pakcoy bolong gede, jebule ono uler",
    body: "Lur, heran aku. Pod nang njero omah kok iso kecolongan uler. Godong pakcoy bolong gede-gede. Uler e ketemu 2, wis diamanke. Kok iso mlebu ya?",
    comments: [
      { userIndex: 8, body: "Soko lawang pak, ngengate mlebu pas dibuka." },
      { userIndex: 21, body: "Cek rockwool e pak, kadang kebawa." },
      { userIndex: 27, body: "Semprot mimba tipis pak." },
    ],
    likes: [8, 21, 27],
  },
  {
    userIndex: 15,
    title: "Itung-itungan setahun pod, balik modal!",
    body: "Lur, tak itung setahun. Modal pod + nutrisi 1,2 juta. Belanja sayur sing biasane 100rb seminggu dadi 30rb. Setahun hemat 3,6 juta. Balik modal 4 sasi. Monggo diitung dewe.",
    comments: [
      { userIndex: 6, body: "Masuk akal pak! Lumayan tenan." },
      { userIndex: 25, body: "Matematika petani kota, haha. Mantap pak." },
      { userIndex: 0, body: "Iki meyakinkan buat calon pembeli pod." },
      { userIndex: 33, body: "Izin share ke grup WA pak!" },
    ],
    likes: [6, 25, 0, 33, 11],
  },
  // ─── Ratna Sari Dewi (Sleman, 3 posts) ───
  {
    userIndex: 16,
    title: "Cabai nang lahanku wis kembang!",
    body: "Seneng poll lur, cabai nang lahanku wis kembang-kembang! Pertama kali nanam cabai skala lahan. Doakan dadi buah ya!",
    comments: [
      { userIndex: 2, body: "Aamiin mbak! Ojo telat banyu pas kembang." },
      { userIndex: 22, body: "Selamat mbak Ratna!" },
      { userIndex: 30, body: "Ikut seneng mbak!" },
    ],
    likes: [2, 22, 30, 8],
  },
  {
    userIndex: 16,
    title: "Ternyata grafik aplikasi iso diwoco",
    body: "Lur, awalnya tak pikir gambar nang aplikasi mung pajangan. Jebule iso diwoco polane. Saiki aku iso nebak kapan kudu nyiram. Seru ternyata.",
    comments: [
      { userIndex: 24, body: "Betul mbak! Nek aneh berarti ono masalah." },
      { userIndex: 17, body: "Aku juga baru ngeh mbak." },
    ],
    likes: [24, 17],
  },
  {
    userIndex: 16,
    title: "Cabai pentil dicucuki manuk, huhu",
    body: "Lur, cabai sing wis pentil dicucuki manuk! Saben esuk ono sing bolong. Ono trik murah? Kaset bekas efektif ora?",
    comments: [
      { userIndex: 10, body: "Kaset efektif mbak, ganti posisi tiap minggu." },
      { userIndex: 20, body: "Tutup separuh ae mbak sing lagi pentil." },
      { userIndex: 28, body: "Manuke pinter mbak, kaset ae." },
      { userIndex: 34, body: "Aku pakai lonceng bambu mbak." },
    ],
    likes: [10, 20, 28, 34],
  },
  // ─── Bambang Sutrisno (Purworejo, 2 posts) ───
  {
    userIndex: 17,
    title: "Tomatku manis poll lur!",
    body: "Lur, tomat nang lahanku manise poll! Tak kurangi banyune pas buah mateng, jebule bener tambah manis. Monggo dicoba.",
    comments: [
      { userIndex: 3, body: "Wah ilmune daging pak! Tak coba." },
      { userIndex: 25, body: "Mantap pak!" },
    ],
    likes: [3, 25],
  },
  {
    userIndex: 17,
    title: "Mendung seminggu, baterai mudun, aman ora?",
    body: "Takon lur, mendung seminggu ngene iki bateraine mudun 20%. Opo perlu dicas? Wedi mati pas butuh nyiram.",
    comments: [
      { userIndex: 24, body: "Aman pak, mendung tetep ngisi pelan." },
      { userIndex: 2, body: "Nek was-was siram manual disik pak." },
      { userIndex: 30, body: "Punyaku pernah 15%, aman pak." },
    ],
    likes: [24, 2, 30],
  },
  // ─── Siti Aminah (Bantul, 3 posts) ───
  {
    userIndex: 18,
    title: "Bayam petik berkali-kali, ngirit!",
    body: "Bun, bayamku tak petiki godonge tok, jebule tukul terus. Wis panen 3x! Ngirit bibit tenan. Ono sing ngono juga?",
    comments: [
      { userIndex: 8, body: "Aku bun! Iso 4-5x." },
      { userIndex: 27, body: "Jos bun, tak tiru." },
    ],
    likes: [8, 27],
  },
  {
    userIndex: 18,
    title: "Sayur bobor dari kebun sendiri",
    body: "Hari ini masak bobor bayam + katuk metik dewe. Segere beda bun. Anak-anak juga doyan. Bahagia itu sederhana ya.",
    comments: [
      { userIndex: 1, body: "Bobor seger tenan bun!" },
      { userIndex: 31, body: "Jadi pengen nanam katuk juga." },
    ],
    likes: [1, 31],
  },
  {
    userIndex: 18,
    title: "Tanya, katuk bisa di pod ora bun?",
    body: "Bun, katuk iso ditandur nang pod ora ya? Pengen nyoba soale enak buat bobor. Ono sing tau?",
    comments: [
      { userIndex: 5, body: "Iso bun, tapi potong rutin ben ora duwur." },
      { userIndex: 12, body: "Aku nanam bun, subur kok." },
    ],
    likes: [5, 12],
  },
  // ─── Dedi Kurniawan (Yogyakarta, 2 posts) ───
  {
    userIndex: 19,
    title: "Pecel sayur full metik dewe, marem!",
    body: "Lur, pecelku saiki sayure metik dewe kabeh: bayam, kacang panjang... eh kacang tuku ding. Tapi 80% dewe! Marem poll.",
    comments: [
      { userIndex: 5, body: "Haha jujur mas. 80% wis apik!" },
      { userIndex: 0, body: "Pecel sayur dewe, nikmat." },
    ],
    likes: [5, 0],
  },
  {
    userIndex: 19,
    title: "Anakku rebutan metik selada",
    body: "Lur, anakku sing maune susah sayur, saiki rebutan metik selada. Jare metik dewe luwih enak. Ajak anak nanam, ngaruh tenan!",
    comments: [
      { userIndex: 31, body: "Setuju mas, praktek langsung paling ampuh." },
      { userIndex: 1, body: "Podo mas, anakku juga ngono." },
      { userIndex: 7, body: "Seneng ya mas liat anak doyan sayur." },
    ],
    likes: [31, 1, 7],
  },
  // ─── Nur Hidayah (Gunungkidul, 2 posts) ───
  {
    userIndex: 20,
    title: "Kemangi nang lahan kering Gunungkidul",
    body: "Lur, aku nang Gunungkidul, lemahe garing. Kemangiku kok yo tukul subur. Tanduran kuat tenan. Ono sing podo lahan garing?",
    comments: [
      { userIndex: 6, body: "Kemangi pancen bandel mbak, cocok lahan garing." },
      { userIndex: 4, body: "Setuju, punyaku yo ngono." },
    ],
    likes: [6, 4],
  },
  {
    userIndex: 20,
    title: "Jaring buat lindungi cabai, murah!",
    body: "Sharing mbak-mbak, cabai pentilku tak tutup jaring separuh, sing pentil tok. Murah, tuku meteran nang pasar. Manuke ora iso nyucuk.",
    comments: [
      { userIndex: 16, body: "Wah pinter mbak, tak tiru!" },
      { userIndex: 10, body: "Murah meriah solutif." },
    ],
    likes: [16, 10],
  },
  // ─── Heri Susanto (Kulon Progo, 2 posts) ───
  {
    userIndex: 21,
    title: "Sore nyiram karo ngopi, nikmat",
    body: "Kegiatan sore: nyiram pod karo ngopi nang teras. Ndelok ijo-ijo, utek adem. Hiburan bapak-bapak murah meriah, haha.",
    comments: [
      { userIndex: 4, body: "Podoku juga hiburan mas!" },
      { userIndex: 32, body: "Ngopi + kebun, pas." },
    ],
    likes: [4, 32],
  },
  {
    userIndex: 21,
    title: "Rockwool iso diganti busa ternyata",
    body: "Lur, aku nyoba ganti rockwool nganggo busa cuci 3x. Jebule tukul podo ae! Hemat lumayan. Sing rung tau monggo dicoba.",
    comments: [
      { userIndex: 11, body: "Wah makasih infone mas, tak coba." },
      { userIndex: 0, body: "Hemat tenan mas." },
    ],
    likes: [11, 0],
  },
  // ─── Wulan Puspita (Sleman, 3 posts) ───
  {
    userIndex: 22,
    title: "Panen mint buat es teh seger",
    body: "Guys, mint-ku panen akeh, tak gawe es teh mint. Seger poll! Resep: mint + teh + es + gula dikit. Wajib coba pas panas.",
    comments: [
      { userIndex: 13, body: "Wah seger mbak! Tak coba sesuk." },
      { userIndex: 4, body: "Es teh mint favoritku juga mbak." },
      { userIndex: 28, body: "Tambah jeruk nipis mbak, tambah jos." },
    ],
    likes: [13, 4, 28],
  },
  {
    userIndex: 22,
    title: "Selada pod-ku kok cilik terus ya?",
    body: "Lur, seladaku umur 3 minggu kok isih cilik? Tonggoku podo umur wis gede. Opo kurang cahaya? Pod-ku nang njero, lampune 12 jam.",
    comments: [
      { userIndex: 3, body: "Coba tambah jam lampune mbak, 14 jam." },
      { userIndex: 9, body: "Nutrisine ditambah dikit mbak." },
    ],
    likes: [3, 9],
  },
  {
    userIndex: 22,
    title: "Kalsium buat bunga cabai, beneran ngaruh!",
    body: "Sharing lur, cabai bungaku tak semprot kalsium dikit, bungane dadi kuat ora rontok. Maune rontok terus. Monggo dicoba sing bungane rontok.",
    comments: [
      { userIndex: 16, body: "Wah makasih mbak, bungaku juga rontok." },
      { userIndex: 2, body: "Betul mbak, kalsium ngunci bunga." },
      { userIndex: 30, body: "Noted, tak tuku kalsium." },
    ],
    likes: [16, 2, 30],
  },
  // ─── Rudi Hartono (Solo, 2 posts) ───
  {
    userIndex: 23,
    title: "Barter bibit Solo-Jogja?",
    body: "Lur, aku Solo, duwe bibit tomat turah. Barter karo selada opo kemangi monggo. Nek pas arah Jogja iso COD.",
    comments: [
      { userIndex: 14, body: "Gelem mas! Tak inbox ya." },
      { userIndex: 10, body: "Aku Solo juga mas, melu!" },
    ],
    likes: [14, 10],
  },
  {
    userIndex: 23,
    title: "Cabai rawit balkon kos, lumayan!",
    body: "Lur, cabai rawit nang balkon kosku wis pentil-pentil! Seneng poll. Modal pod + sabar. Anak kos iso tani!",
    comments: [
      { userIndex: 10, body: "Jos mas! Anak kos tani, mantap." },
      { userIndex: 29, body: "Semangat mas!" },
    ],
    likes: [10, 29],
  },
  // ─── Endang Susanti (Bantul, 3 posts) ───
  {
    userIndex: 24,
    title: "Jagung manisku wis janten!",
    body: "Alhamdulillah bun, jagung nang lahanku wis janten-janten! Umur 2 sasi. Mugo-mugo isine penuh. Doakan ya bun!",
    comments: [
      { userIndex: 2, body: "Aamiin mbak! Ojo telat banyu pas janten." },
      { userIndex: 17, body: "Mantap mbak Endang!" },
      { userIndex: 30, body: "Semoga panene melimpah mbak." },
    ],
    likes: [2, 17, 30],
  },
  {
    userIndex: 24,
    title: "Ulat nang jagung, tak petiki manual",
    body: "Bun, jagungku ono ulere nang pucuk. Tak petiki manual wae saben sore, lumayan ilang. Eman nek nyemprot. Ono sing ngono juga?",
    comments: [
      { userIndex: 8, body: "Aku juga manual bun, sekalian jalan sore." },
      { userIndex: 27, body: "Semprot mimba tipis bun ben ora bali." },
    ],
    likes: [8, 27],
  },
  {
    userIndex: 24,
    title: "Bakul jagung bakar langganan, alhamdulillah",
    body: "Cerita bun, jagungku dituku bakul bakar langganan, regane apik soale manis. Saiki nandur luwih ombo. Rejeki petani!",
    comments: [
      { userIndex: 10, body: "Alhamdulillah bun! Langganan itu rejeki." },
      { userIndex: 25, body: "Mantap bun, pasar pasti." },
      { userIndex: 5, body: "Seneng dengernya bun!" },
    ],
    likes: [10, 25, 5],
  },
  // ─── Galih Pratama (Yogyakarta, 2 posts) ───
  {
    userIndex: 25,
    title: "Tomatku merah-merah, siap panen!",
    body: "Lur, tomat nang lahanku wis abang-abang! Sesuk panen perdana. Deg-degan regane piye. Doakan ya lur!",
    comments: [
      { userIndex: 3, body: "Selamat mas! Semoga regane apik." },
      { userIndex: 17, body: "Panen perdana selalu deg-degan mas, haha." },
    ],
    likes: [3, 17],
  },
  {
    userIndex: 25,
    title: "Itung-itung pod setahun, hemat!",
    body: "Lur, tak itung pod-ku setahun. Belanja sayur mudun drastis. Balik modal 4 sasi. Sing rung duwe pod, pikir-pikir, haha.",
    comments: [
      { userIndex: 6, body: "Masuk akal mas!" },
      { userIndex: 0, body: "Meyakinkan tenan." },
      { userIndex: 33, body: "Izin share mas!" },
    ],
    likes: [6, 0, 33],
  },
  // ─── Tutik Lestari (Klaten, 2 posts) ───
  {
    userIndex: 26,
    title: "Nutrisi boros ternyata gara-gara tandon kebuka",
    body: "Bun, punyaku boros poll, seminggu entek. Jebule tandone kebuka, nguap! Wis tak tutup saiki. Ono sing podo? Haha.",
    comments: [
      { userIndex: 5, body: "Aku bun! Sama persis. Tutup langsung irit." },
      { userIndex: 9, body: "Haha podo bun, pelajaran berharga." },
    ],
    likes: [5, 9],
  },
  {
    userIndex: 26,
    title: "Mudik pod dititipke tonggo, aman!",
    body: "Tips bun: mudik wingi pod tak titipke tonggo, tak titipi jajan. Bali-bali tanduran seger. Tonggo apik rejeki!",
    comments: [
      { userIndex: 12, body: "Haha bener bun, tonggo apik larang regane." },
      { userIndex: 15, body: "Solusi paling manusiawi." },
    ],
    likes: [12, 15],
  },
  // ─── Andri Wibowo (Magelang, 3 posts) ───
  {
    userIndex: 27,
    title: "Bayam cabut sekali panen marem!",
    body: "Lur, bayam cabutku panen total sesekop, oleh seember! Langsung dibagi tonggo. Nandur bareng-bareng panen bareng, seru!",
    comments: [
      { userIndex: 18, body: "Seember! Marem tenan mas." },
      { userIndex: 8, body: "Bagi tonggo berkah mas." },
    ],
    likes: [18, 8],
  },
  {
    userIndex: 27,
    title: "Kutu putih ilang nganggo banyu sabun",
    body: "Sharing lur, kutu putih nang kemangiku ilang! Carane: banyu + sabun cuci piring dikit + bawang. Semprot 3 dino pisan, 2 minggu resik. Murah meriah.",
    comments: [
      { userIndex: 13, body: "Wah makasih mas, kutuku juga akeh." },
      { userIndex: 3, body: "Noted mas! Tak coba." },
      { userIndex: 9, body: "Murah meriah manjur, jos." },
    ],
    likes: [13, 3, 9],
  },
  {
    userIndex: 27,
    title: "Uler grayak nang pod, kok iso?",
    body: "Lur, pod nang njero omah kok iso kecolongan uler. Godong bolong gede. Uler e ketemu, wis diamanke. Kok iso mlebu ya?",
    comments: [
      { userIndex: 15, body: "Soko lawang mas, ngengate mlebu." },
      { userIndex: 21, body: "Cek rockwool e mas." },
    ],
    likes: [15, 21],
  },
  // ─── Dian Puspitasari (Sleman, 2 posts) ───
  {
    userIndex: 28,
    title: "Mint + jeruk nipis, kombinasi jos!",
    body: "Guys, es teh mint + jeruk nipis tuh jos banget. Seger poll. Daune metik dewe nang pod. Kafe kalah!",
    comments: [
      { userIndex: 22, body: "Wah kafe kalah, haha. Tak coba mbak!" },
      { userIndex: 4, body: "Setuju mbak, seger." },
    ],
    likes: [22, 4],
  },
  {
    userIndex: 28,
    title: "Minta saran isi pod kedua",
    body: "Guys, pod pertamaku isi selada wis panen. Pod kedua bingung isi opo. Sing cepet panen lan gampang opo ya? Minta saran.",
    comments: [
      { userIndex: 5, body: "Kangkung mbak, 3 minggu panen!" },
      { userIndex: 11, body: "Bayam mbak, gampang poll." },
      { userIndex: 0, body: "Pakcoy mbak, sebulan panen." },
    ],
    likes: [5, 11, 0],
  },
  // ─── Yoga Saputra (Bantul, 3 posts) ───
  {
    userIndex: 29,
    title: "Rak pod-ku rapi, pamer dikit",
    body: "Pamer lur, rak pod-ku rapi ijo-ijo. Tonggo pada takon. Sopo ngerti dadi bakul pod, haha.",
    comments: [
      { userIndex: 3, body: "Apik mas! Rapi tenan." },
      { userIndex: 23, body: "Dadi sales pod dadakan, haha." },
    ],
    likes: [3, 23],
  },
  {
    userIndex: 29,
    title: "Mati lampu suwe, pod-ku pie?",
    body: "Lur, nang gonku mati lampu suwe wingi. Pod lemes. Untung murup meneh sesuke pulih. Ono sing tau? Deg-degan aku.",
    comments: [
      { userIndex: 6, body: "Tau mas, pulih kok. Tanduran kuat." },
      { userIndex: 15, body: "Syukur mas!" },
    ],
    likes: [6, 15],
  },
  {
    userIndex: 29,
    title: "Cabai balkon kos wis pentil!",
    body: "Lur, cabai nang balkon kosku wis pentil-pentil! Seneng poll. Anak kos iso tani tenan!",
    comments: [
      { userIndex: 10, body: "Jos mas! Semangat!" },
      { userIndex: 23, body: "Mantap!" },
    ],
    likes: [10, 23],
  },
  // ─── Eka Puspita Sari (Yogyakarta, 2 posts) ───
  {
    userIndex: 30,
    title: "Rego cabai mundak, alhamdulillah!",
    body: "Bun, rego cabai nang pasar mundak! Pas banget panenku sesuk. Rejeki ora kemana. Alhamdulillah!",
    comments: [
      { userIndex: 24, body: "Alhamdulillah bun! Pas tenan." },
      { userIndex: 16, body: "Seneng dengernya bun!" },
      { userIndex: 2, body: "Rejeki petani bun." },
    ],
    likes: [24, 16, 2],
  },
  {
    userIndex: 30,
    title: "Selada pait gara-gara telat panen",
    body: "Pelajaran bun: seladaku telat panen seminggu, dadi pait. Eman tenan. Panen tepat waktu ya bun, ojo ditunda-tunda!",
    comments: [
      { userIndex: 11, body: "Iya bun, selada tua pait." },
      { userIndex: 14, body: "Pengalaman sama bun, haha." },
    ],
    likes: [11, 14],
  },
  // ─── Bayu Aditya (Gunungkidul, 2 posts) ───
  {
    userIndex: 31,
    title: "Stroberi nang pod dataran rendah, iso jebule!",
    body: "Lur, jare stroberi mung iso nang dataran tinggi. Tak coba nang Gunungkidul, jebule berbuah! Cilik-cilik tapi manis. Ojo percoyo mitos, dicoba ae!",
    comments: [
      { userIndex: 3, body: "Wah hebat mas! Varietas opo?" },
      { userIndex: 7, body: "Motivasi tenan mas!" },
      { userIndex: 31, body: "Mencir mas, lokal adaptif." },
    ],
    likes: [3, 7, 5],
  },
  {
    userIndex: 31,
    title: "Banyu udan tak tampung go campuran",
    body: "Tips lur: banyu udan tak tampung tong, go campuran nutrisi. Lumayan hemat. Ojo banyu got ya, haha.",
    comments: [
      { userIndex: 5, body: "Haha iya mas, banyu udan resik." },
      { userIndex: 9, body: "Pinter mas, tak tiru." },
    ],
    likes: [5, 9],
  },
  // ─── Novi Astuti (Kulon Progo, 2 posts) ───
  {
    userIndex: 32,
    title: "Sore nyiram karo anak, quality time",
    body: "Bun, sore nyiram pod karo anakku dadi quality time. Dheweke sing metik, aku sing masak. Anak happy, ibu happy.",
    comments: [
      { userIndex: 19, body: "Indah bun! Momen ora ternilai." },
      { userIndex: 1, body: "Setuju bun, anakku juga gitu." },
    ],
    likes: [19, 1],
  },
  {
    userIndex: 32,
    title: "Kabel pod aman nganggo paralon",
    body: "Sharing bun, kabel pod-ku tak lewatkan paralon cilik. Aman soko tikus. Murah, tuku meteran.",
    comments: [
      { userIndex: 8, body: "Pinter bun! Tak tiru." },
      { userIndex: 2, body: "Solusi rapi juga." },
    ],
    likes: [8, 2],
  },
  // ─── Tono Prasetyo (Wonosari, 2 posts) ───
  {
    userIndex: 33,
    title: "Salam kenal soko Wonosari!",
    body: "Halo lur, aku pendatang baru soko Wonosari. Pod isih umur 2 minggu, isine bayam. Nyuwun bimbingane!",
    comments: [
      { userIndex: 6, body: "Salam kenal mas! Tonggo dewe." },
      { userIndex: 0, body: "Sugeng rawuh mas Tono!" },
      { userIndex: 20, body: "Wonosari hadir! Semangat mas." },
    ],
    likes: [6, 0, 20],
  },
  {
    userIndex: 33,
    title: "Bayamku siap panen minggu ini!",
    body: "Update lur, bayamku wis gede-gede, minggu iki panen perdana! Deg-degan. Doakan ya!",
    comments: [
      { userIndex: 11, body: "Semoga panene apik mas!" },
      { userIndex: 5, body: "Selamat mas Tono!" },
    ],
    likes: [11, 5],
  },
  // ─── Ayu Wulandari (Sleman, 3 posts) ───
  {
    userIndex: 34,
    title: "Lonceng bambu ngusir manuk, tradisional jos!",
    body: "Guys, cabai pentilku tak pasangi lonceng bambu, muni-muni ditiup angin. Manuke wedi! Tradisional tapi manjur.",
    comments: [
      { userIndex: 16, body: "Wah kreatif mbak! Tak gawe juga." },
      { userIndex: 10, body: "Seni + fungsi ya mbak." },
      { userIndex: 20, body: "Apik mbak, alami." },
    ],
    likes: [16, 10, 20],
  },
  {
    userIndex: 34,
    title: "Panen perdana tomat, deg-degan!",
    body: "Besok panen tomat perdana guys! Wis abang-abang. Deg-degan regane piye. Doakan ya!",
    comments: [
      { userIndex: 25, body: "Semoga regane apik mbak!" },
      { userIndex: 3, body: "Selamat mbak Ayu!" },
    ],
    likes: [25, 3],
  },
  {
    userIndex: 34,
    title: "Swafoto karo panenan, wajib!",
    body: "Tradisi Guys: saben panen wajib swafoto karo hasile. Koleksiku wis akeh. Ono sing podo?",
    comments: [
      { userIndex: 7, body: "Haha podo mbak! Buat status WA." },
      { userIndex: 29, body: "Wajib! Bukti petani kota." },
    ],
    likes: [7, 29],
  },
  // ─── Puji Lestari (Bantul, 2 posts) ───
  {
    userIndex: 35,
    title: "Pod pojok kamar, adem!",
    body: "Bun, pod-ku tak taruh pojok kamar. Adem didelok, apalagi bengi. Tidur nyenyak. Ono sing pod-ku nang kamar juga?",
    comments: [
      { userIndex: 7, body: "Aku bun! Adem tenan." },
      { userIndex: 14, body: "Podo bun, ijo-ijo nenangke." },
    ],
    likes: [7, 14],
  },
  {
    userIndex: 35,
    title: "Manuk wedi kaset, ngakak!",
    body: "Bun, tak pasang kaset bekas nang lahan, manuke bingung! Mubeng-mubeng ora wani mudun. Ngakak delokne. Murah meriah manjur.",
    comments: [
      { userIndex: 16, body: "Haha kasian manuke bun, tapi panen aman!" },
      { userIndex: 10, body: "Klasik tapi manjur bun." },
    ],
    likes: [16, 10],
  },
]

export default seedData
