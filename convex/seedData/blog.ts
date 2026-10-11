// Seed dataset — hand-maintained. Image bytes live in public/seed-images/<hash>/;
// this module carries only content hashes (see convex/seed/images.ts).
import type { BlogSeedData, SeedImage } from './types'

// Image bytes live in public/seed-images/6bf3f73d7415dd9a/ — this module carries only the hash.
const defaultImage: SeedImage = { hash: "6bf3f73d7415dd9a" }

const seedData: BlogSeedData[] = [
  // BEGINNER GUIDES (~4)
  {
    title: "Panduan Lengkap Hidroponik untuk Pemula 2025",
    excerpt: "Pelajari cara memulai hidroponik dari nol dengan panduan langkah demi langkah yang mudah dipahami oleh pemula sekalipun.",
    body: "Hidroponik adalah metode bercocok tanam tanpa tanah yang semakin populer di Indonesia. Dengan lahan terbatas sekalipun, Anda bisa menanam sayuran segar di rumah.\n\n## Apa Saja yang Dibutuhkan?\n\nUntuk memulai hidroponik, Anda perlu menyiapkan beberapa peralatan dasar: wadah atau pipa untuk tempat tanaman, pompa air untuk sirkulasi nutrisi, netpot sebagai dudukan tanaman, rockwool atau hidroton sebagai media tanam, serta nutrisi AB mix.\n\n## Memilih Sistem yang Tepat\n\nUntuk pemula, sistem wick adalah pilihan termudah dan termurah. Sistem ini tidak memerlukan listrik karena menggunakan sumbu untuk menyalurkan nutrisi. Setelah terbiasa, Anda bisa beralih ke sistem NFT atau DFT yang lebih produktif.\n\n## Langkah Memulai\n\nPertama, siapkan benih dan semai di rockwool yang sudah dibasahi. Setelah muncul 2-4 daun sejati, pindahkan ke sistem hidroponik. Beri nutrisi AB mix dengan dosis sesuai petunjuk. Monitor pH dan TDS secara rutin.\n\n## Tips Sukses\n\nKunci sukses hidroponik adalah konsistensi. Cek tanaman setiap hari, catat perkembangan, dan jangan ragu bertanya di komunitas. Dengan kesabaran, panen pertama akan tiba dalam 30-45 hari.",
    published: true,
    featured: true,
    image: defaultImage,
  },
  {
    title: "Mengenal 4 Sistem Hidroponik Paling Populer",
    excerpt: "Wick, NFT, DFT, dan Deep Water Culture — kenali kelebihan dan kekurangan masing-masing sistem hidroponik sebelum memilih.",
    body: "Ada beberapa sistem hidroponik yang umum digunakan. Masing-masing memiliki kelebihan dan kekurangan tersendiri.\n\n## Sistem Wick\n\nSistem paling sederhana tanpa pompa. Nutrisi disalurkan melalui sumbu ke akar tanaman. Cocok untuk tanaman kecil seperti selada dan sayuran daun. Kelemahannya, kurang cocok untuk tanaman besar yang butuh banyak nutrisi.\n\n## Sistem NFT (Nutrient Film Technique)\n\nLapisan tipis nutrisi dialirkan ke akar tanaman. Efisien dan populer untuk produksi skala rumah maupun komersial. Memerlukan pompa dan listrik 24 jam. Sangat baik untuk selada dan sayuran daun.\n\n## Sistem DFT (Deep Flow Technique)\n\nMirip NFT tapi dengan aliran nutrisi yang lebih dalam sehingga akar selalu terendam. Lebih toleran terhadap mati listrik karena nutrisi tetap tersedia untuk tanaman dalam waktu singkat.\n\n## Sistem DWC (Deep Water Culture)\n\nAkar tanaman terendam langsung dalam larutan nutrisi yang diaerasi dengan pompa udara. Sederhana dan murah. Cocok untuk tanaman daun dan herba.\n\nPilih sistem yang sesuai dengan budget, lahan, dan jenis tanaman yang ingin Anda budidayakan.",
    published: true,
    featured: true,
    image: defaultImage,
  },
  {
    title: "Cara Memilih Bibit Sayuran untuk Hidroponik",
    excerpt: "Tidak semua bibit sayuran cocok untuk hidroponik. Simak tips memilih bibit yang tepat agar panen maksimal.",
    body: "Pemilihan bibit adalah faktor penting yang sering diremehkan pemula. Bibit yang berkualitas akan menentukan keberhasilan panen Anda.\n\n## Ciri Bibit Berkualitas\n\nBibit yang baik memiliki daya kecambah minimal 85%, bebas dari hama dan penyakit, serta memiliki masa simpan yang masih panjang. Perhatikan tanggal kedaluwarsa pada kemasan.\n\n## Varietas yang Cocok untuk Hidroponik\n\nBeberapa varietas sayuran telah dikembangkan khusus untuk hidroponik. Misalnya selada varietas Grand Rapids untuk daun yang renyah, atau cabai varietas F1 untuk produktivitas tinggi. Pilih varietas yang tahan terhadap kondisi stres seperti suhu tinggi.\n\n## Tips Penyemaian\n\nGunakan rockwool yang sudah direndam air pH 5.5-6.0. Letakkan 1-2 benih per lubang. Tutup tipis-tipis dengan vermikulit. Jaga kelembaban dengan spray. Letakkan di tempat teduh selama 3-5 hari hingga berkecambah.",
    published: true,
    featured: false,
    image: defaultImage,
  },
  {
    title: "Biaya Memulai Hidroponik di Rumah",
    excerpt: "Rincian biaya untuk memulai hidroponik skala rumah tangga dengan budget minimal hingga menengah.",
    body: "Salah satu pertanyaan paling sering adalah berapa biaya untuk memulai hidroponik. Jawabannya tergantung skala dan sistem yang dipilih.\n\n## Budget Minimal (Rp300.000 - Rp500.000)\n\nUntuk budget ini, Anda bisa membuat sistem wick atau botol bekas. Peralatan yang dibutuhkan: botol bekas (gratis), sumbu kain (Rp10.000), rockwool (Rp25.000), netpot 10 pcs (Rp20.000), nutrisi AB mix 500ml (Rp75.000), benih (Rp30.000), dan pH test kit (Rp50.000).\n\n## Budget Menengah (Rp500.000 - Rp1.500.000)\n\nDengan budget ini Anda bisa membuat sistem NFT atau DFT sederhana dari pipa PVC. Peralatan: pipa PVC 3 batang (Rp200.000), pompa akuarium (Rp100.000), selang dan fitting (Rp50.000), netpot 20 pcs (Rp40.000), rockwool 50 pcs (Rp50.000), nutrisi AB mix 1 liter (Rp150.000), pH dan TDS meter (Rp200.000), dan benih (Rp50.000).\n\n## Biaya Operasional Bulanan\n\nBiaya listrik untuk pompa sekitar Rp30.000 - Rp100.000 per bulan. Nutrisi AB mix habis sekitar Rp100.000 - Rp200.000 per bulan tergantung jumlah tanaman. Biaya ini akan tertutup dengan hasil panen yang bisa dijual atau dikonsumsi sendiri.",
    published: true,
    featured: false,
    image: defaultImage,
  },

  // PLANT-SPECIFIC GUIDES (~6)
  {
    title: "Panduan Menanam Selada Hidroponik dari Awal Hingga Panen",
    excerpt: "Selada adalah tanaman paling populer untuk hidroponik. Pelajari cara menanamnya dari semai hingga panen dengan hasil maksimal.",
    body: "Selada (Lactuca sativa) adalah tanaman yang paling banyak dibudidayakan secara hidroponik di Indonesia. Pertumbuhannya cepat, perawatannya mudah, dan nilai ekonominya menjanjikan.\n\n## Persiapan dan Penyemaian\n\nRendam benih selada dalam air hangat selama 2-3 jam sebelum disemai. Semai di rockwool yang sudah dibasahi dengan pH 5.5-6.0. Perkecambahan terjadi dalam 3-5 hari. Setelah muncul 4 daun sejati, pindahkan ke sistem hidroponik.\n\n## Nutrisi dan pH\n\nSelada membutuhkan TDS 800-1200 ppm dan pH 5.5-6.5. Pada fase vegetatif, kebutuhan nitrogen lebih tinggi. Saau memasuki fase dewasa, tingkatkan kalium untuk kualitas daun yang lebih baik.\n\n## Pencahayaan\n\nSelada membutuhkan intensitas cahaya 40-60%. Terlalu banyak cahaya bisa menyebabkan daun pahit dan tanaman cepat berbunga. Jika menanam indoor, gunakan lampu LED 12-16 jam per hari.\n\n## Panen\n\nSelada bisa dipanen 30-45 hari setelah semai. Panen dengan cara memotong pangkal batang atau memetik daun luar secara bertahap. Simpan dalam kulkas dengan kelembaban tinggi agar tetap segar hingga 1 minggu.",
    published: true,
    featured: true,
    image: defaultImage,
  },
  {
    title: "Panduan Lengkap Menanam Cabai secara Hidroponik",
    excerpt: "Cabai rawit dan cabai keriting bisa ditanam hidroponik dengan hasil melimpah. Ikuti panduan ini untuk panen cabai sepanjang tahun.",
    body: "Cabai adalah tanaman buah yang menantang tapi sangat memuaskan untuk dibudidayakan secara hidroponik. Dengan perawatan yang tepat, Anda bisa memanen cabai sepanjang tahun.\n\n## Persiapan Bibit\n\nPilih bibit cabai unggul seperti varietas F1 yang tahan penyakit. Rendam benih dalam air hangat selama 6-8 jam untuk mempercepat perkecambahan. Semai di rockwool dan letakkan di tempat hangat (25-30°C). Perkecambahan membutuhkan waktu 7-14 hari.\n\n## Nutrisi dan Pemupukan\n\nCabai membutuhkan nutrisi lengkap dengan TDS 1400-2000 ppm. Pada fase vegetatif, gunakan rasio nitrogen tinggi. Saat memasuki fase berbunga, tingkatkan fosfor dan kalium untuk merangsang pembentukan buah. pH ideal 5.8-6.3.\n\n## Penyerbukan\n\nKarena hidroponik biasanya indoor, penyerbukan perlu dibantu. Anda bisa menggunakan kuas kecil untuk memindahkan serbuk sari atau menggunakan kipas angin untuk membantu penyebaran serbuk sari.\n\n## Pengendalian Hama\n\nHama umum cabai adalah kutu daun, thrips, dan tungau. Lakukan pencegahan dengan menjaga kebersihan lingkungan dan menggunakan pestisida organik secara rutin.\n\n## Panen\n\nCabai mulai bisa dipanen 70-90 hari setelah tanam. Petik cabai yang sudah merah atau sesuai varietas. Pemangkasan rutin akan merangsang pertumbuhan cabang baru dan buah lebih banyak.",
    published: true,
    featured: false,
    image: defaultImage,
  },
  {
    title: "Cara Menanam Tomat Hidroponik yang Manis dan Lebat",
    excerpt: "Tomat ceri dan tomat beef bisa ditanam hidroponik dengan rasa yang lebih manis. Simak cara menanamnya di sini.",
    body: "Tomat adalah salah satu tanaman buah yang paling populer untuk hidroponik. Rasanya lebih manis dibanding tomat tanah karena kadar nutrisi yang lebih terkontrol.\n\n## Persiapan\n\nPilih varietas tomat yang cocok untuk hidroponik seperti tomat ceri, tomat beef, atau tomat roma. Semai benih di rockwool dengan suhu 22-28°C. Perkecambahan terjadi dalam 5-10 hari.\n\n## Nutrisi\n\nTomat membutuhkan TDS 1400-2500 ppm tergantung fase pertumbuhan. pH ideal 6.0-6.5. Kalsium sangat penting untuk mencegah blossom end rot. Tambah suplemen kalsium jika diperlukan.\n\n## Dukungan Tanaman\n\nTomat adalah tanaman merambat yang membutuhkan ajir atau tali untuk menopang batang. Gunakan tali raffia atau bambu. Pangkas tunas samping (suckers) agar nutrisi fokus ke buah.\n\n## Penyerbukan\n\nSeperti cabai, penyerbukan tomat perlu dibantu jika ditanam di dalam ruangan. Getarkan batang tanaman setiap pagi untuk membantu penyerbukan.\n\n## Panen\n\nTomat mulai berbuah 60-80 hari setelah tanam. Panen saat buah menunjukkan warna merah merata atau sesuai varietas. Simpan pada suhu ruang untuk rasa optimal.",
    published: true,
    featured: false,
    image: defaultImage,
  },
  {
    title: "Budidaya Kemangi Hidroponik untuk Pemula",
    excerpt: "Kemangi adalah tanaman herba yang sangat mudah ditanam hidroponik. Cocok untuk pemula yang ingin belajar berkebun.",
    body: "Kemangi (Ocimum basilicum) adalah tanaman herba yang mudah ditanam dan sangat produktif secara hidroponik. Aroma khasnya membuat kemangi selalu dicari untuk lalapan dan masakan.\n\n## Persiapan Bibit\n\nRendam benih kemangi dalam air 2 jam sebelum semai. Semai di rockwool dengan kedalaman 0.5 cm. Perkecambahan terjadi dalam 3-7 hari. Pindahkan ke sistem hidroponik setelah muncul 4 daun.\n\n## Nutrisi\n\nKemangi membutuhkan TDS 800-1400 ppm dengan pH 5.5-6.5. Nitrogen penting untuk pertumbuhan daun yang subur. Gunakan nutrisi AB mix standar dengan dosis sesuai umur tanaman.\n\n## Pemangkasan\n\nPangkas pucuk kemangi secara rutin untuk merangsang pertumbuhan cabang baru. Jangan biarkan kemangi berbunga karena akan menurunkan kualitas daun dan rasa.\n\n## Panen\n\nPanen pertama bisa dilakukan 25-35 hari setelah tanam. Petik daun bagian atas dan batang muda. Kemangi akan terus tumbuh dan bisa dipanen setiap 1-2 minggu sekali.",
    published: true,
    featured: false,
    image: defaultImage,
  },
  {
    title: "Menanam Bayam Hidroponik Cepat Panen dalam 3 Minggu",
    excerpt: "Bayam adalah sayuran paling cepat panen dalam hidroponik. Dalam 3 minggu Anda sudah bisa menikmati bayam segar hasil tanam sendiri.",
    body: "Bayam (Amaranthus hybridus) adalah sayuran daun yang tumbuh sangat cepat dan mudah dalam sistem hidroponik. Cocok untuk pemula yang ingin cepat melihat hasil.\n\n## Penyemaian\n\nSemai benih bayam langsung di rockwool tanpa perendaman. Cukup 2-3 biji per lubang. Perkecambahan terjadi dalam 2-4 hari. Pindahkan ke sistem setelah 7-10 hari atau saat tanaman setinggi 5-7 cm.\n\n## Nutrisi\n\nBayam membutuhkan TDS 600-1000 ppm — lebih rendah dibanding sayuran lain. pH ideal 6.0-7.5 yang cukup toleran. Kelebihan nitrogen bisa menyebabkan daun terlalu lunak dan mudah rusak.\n\n## Suhu dan Cahaya\n\nBayam menyukai suhu 15-25°C. Di suhu di atas 30°C, bayam akan cepat berbunga (bolting) dan daun menjadi pahit. Gunakan naungan jika perlu. Cahaya ideal 40-60%.\n\n## Panen\n\nBayam bisa dipanen 20-30 hari setelah tanam. Panen dengan mencabut seluruh tanaman atau memotong batang 2 cm di atas permukaan. Bayam bisa dipanen ulang jika menyisakan tunas samping.",
    published: true,
    featured: false,
    image: defaultImage,
  },
  {
    title: "Panduan Menanam Pakcoy Hidroponik untuk Pemula",
    excerpt: "Pakcoy atau bok choy adalah sayuran yang sangat cocok untuk hidroponik. Tumbuh cepat, mudah dirawat, dan bernilai ekonomi tinggi.",
    body: "Pakcoy (Brassica rapa subsp. chinensis) adalah sayuran daun yang populer dalam masakan Asia. Teksturnya renyah dan rasanya manis, membuatnya banyak diminati pasar.\n\n## Persiapan\n\nPilih varietas pakcoy yang cocok seperti pakcoy putih atau pakcoy hijau. Rendam benih 3-4 jam sebelum semai. Perkecambahan terjadi dalam 3-5 hari. Pindahkan ke sistem pada umur 10-14 hari.\n\n## Nutrisi\n\nPakcoy membutuhkan TDS 1000-1500 ppm dengan pH 5.5-6.5. Seperti sayuran daun lainnya, nitrogen penting untuk pertumbuhan daun. Pada minggu ke-3, tingkatkan dosis nutrisi untuk hasil optimal.\n\n## Suhu Ideal\n\nPakcoy tumbuh optimal pada suhu 15-22°C. Suhu di atas 25°C bisa menyebabkan tanaman cepat berbunga. Di daerah panas, tanam pakcoy di tempat teduh atau gunakan paranet.\n\n## Pengendalian Hama\n\nHama umum pakcoy adalah ulat dan kutu daun. Gunakan pestisida organik atau musuh alami seperti ladybug. Rotasi tanaman juga membantu mencegah hama.\n\n## Panen\n\nPakcoy siap panen 35-45 hari setelah tanam. Potong pangkal batang 2 cm di atas akar. Pakcoy segar bisa disimpan di kulkas hingga 2 minggu dalam wadah tertutup.",
    published: true,
    featured: false,
    image: defaultImage,
  },

  // TECHNICAL TOPICS (~3)
  {
    title: "Memahami dan Mengelola pH dalam Hidroponik",
    excerpt: "pH adalah faktor krusial dalam hidroponik yang mempengaruhi serapan nutrisi. Pelajari cara mengelola pH dengan benar.",
    body: "pH (potential of Hydrogen) adalah ukuran keasaman atau kebasaan larutan nutrisi. Dalam hidroponik, pH yang tepat sangat penting karena mempengaruhi ketersediaan nutrisi bagi tanaman.\n\n## Rentang pH Ideal\n\nKebanyakan tanaman hidroponik tumbuh optimal pada pH 5.5-6.5. Pada rentang ini, semua nutrisi esensial tersedia dalam bentuk yang bisa diserap akar. Di luar rentang ini, beberapa nutrisi akan mengendap dan tidak bisa diserap.\n\n## Mengukur pH\n\nGunakan pH meter digital untuk pengukuran akurat. Kalibrasi pH meter setiap 2 minggu menggunakan buffer pH 4.0 dan 7.0. Jika tidak punya pH meter, gunakan pH test kit cair yang lebih murah.\n\n## Menurunkan pH\n\nJika pH terlalu tinggi (basa), tambahkan pH Down atau asam fosfat. Lakukan secara bertahap — sedikit demi sedikit sambil diaduk dan diukur ulang. Jangan langsung menambahkan banyak karena pH bisa turun drastis.\n\n## Menaikkan pH\n\nJika pH terlalu rendah (asam), tambahkan pH Up atau kalium hidroksida. Cara yang sama: tambah sedikit demi sedikit sambil diukur.\n\n## Penyebab pH Berfluktuasi\n\npH nutrisi bisa berubah karena beberapa faktor: serapan nutrisi oleh tanaman, penguapan air, kontaminasi, dan kualitas air yang digunakan. Air RO atau air hujan lebih stabil dibanding air sumur.",
    published: true,
    featured: false,
    image: defaultImage,
  },
  {
    title: "Cara Meracik Nutrisi Hidroponik AB Mix yang Benar",
    excerpt: "Panduan lengkap meracik nutrisi AB mix dari dosis hingga cara penyimpanan agar hasil panen maksimal.",
    body: "Nutrisi AB mix adalah komponen vital dalam hidroponik. Meraciknya dengan benar akan menentukan pertumbuhan dan hasil panen tanaman.\n\n## Apa Itu Nutrisi A dan B?\n\nNutrisi A mengandung kalsium nitrat, dan nutrisi B mengandung garam-garam lain seperti kalium fosfat, magnesium sulfat, dan mikronutrisi. Keduanya dipisahkan karena jika dicampur dalam bentuk pekat akan mengendap dan tidak larut.\n\n## Cara Meracik\n\nSiapkan air bersih sesuai volume yang dibutuhkan. Masukkan nutrisi A terlebih dahulu, aduk hingga larut sempurna. Setelah itu masukkan nutrisi B, aduk kembali. Jangan membalik urutan ini.\n\n## Dosis yang Tepat\n\nDosis standar adalah 5 ml nutrisi A + 5 ml nutrisi B per liter air. Untuk tanaman muda (seedling), gunakan setengah dosis. Untuk tanaman dewasa atau berbuah, dosis bisa ditingkatkan menjadi 7-8 ml per liter.\n\n## Penyimpanan\n\nSimpan nutrisi A dan B di tempat terpisah, di tempat yang sejuk dan gelap. Jangan terkena sinar matahari langsung. Tutup rapat setelah digunakan. Nutrisi yang sudah diencerkan sebaiknya digunakan dalam 1-2 minggu.\n\n## Tanda Nutrisi Kadaluarsa\n\nJika nutrisi berbau tidak sedap, berubah warna, atau muncul endapan, sebaiknya jangan digunakan. Nutrisi kadaluarsa bisa membahayakan tanaman.",
    published: true,
    featured: true,
    image: defaultImage,
  },
  {
    title: "Pencahayaan untuk Hidroponik Indoor yang Optimal",
    excerpt: "Tanaman butuh cahaya untuk fotosintesis. Pelajari jenis lampu dan durasi pencahayaan yang tepat untuk hidroponik indoor.",
    body: "Cahaya adalah faktor penting dalam pertumbuhan tanaman. Untuk hidroponik indoor, Anda perlu mengganti sinar matahari dengan lampu tumbuh (grow light).\n\n## Jenis Lampu Tumbuh\n\nAda beberapa jenis lampu yang bisa digunakan: LED (Light Emitting Diode) paling efisien dan hemat listrik, CFL (Compact Fluorescent) lebih murah tapi kurang efisien, dan HID (High Intensity Discharge) sangat terang tapi panas dan boros listrik.\n\n## Intensitas Cahaya\n\nSetiap tanaman membutuhkan intensitas cahaya berbeda. Sayuran daun seperti selada membutuhkan 200-400 umol/m²/s. Tanaman buah seperti tomat dan cabai membutuhkan 400-600 umol/m²/s. Ukur dengan PAR meter atau aplikasi smartphone.\n\n## Durasi Pencahayaan\n\nSebagian besar tanaman membutuhkan 12-18 jam cahaya per hari. Terlalu sedikit cahaya menyebabkan tanaman kurus dan etiolasi. Terlalu banyak cahaya bisa menyebabkan daun terbakar dan tanaman stres.\n\n## Jarak Lampu\n\nJarak lampu ke tanaman juga penting. Lampu LED biasanya dipasang 30-60 cm di atas tanaman. Lampu HID perlu jarak lebih jauh karena panasnya. Sesuaikan jarak jika tanaman menunjukkan tanda stres panas.\n\n## Spektrum Cahaya\n\nTanaman membutuhkan spektrum cahaya biru (400-500 nm) untuk pertumbuhan vegetatif dan merah (600-700 nm) untuk pembungaan dan pembuahan. Lampu LED full spectrum menggabungkan keduanya.",
    published: true,
    featured: false,
    image: defaultImage,
  },

  // PEST/DISEASE MANAGEMENT (~3)
  {
    title: "Mengenal dan Mengatasi Hama pada Tanaman Hidroponik",
    excerpt: "Hama tidak hanya menyerang tanaman tanah, tapi juga hidroponik. Kenali jenis hama dan cara pengendaliannya.",
    body: "Meskipun hidroponik lebih steril dibanding tanah, hama tetap bisa menyerang. Berikut hama paling umum dan cara mengatasinya.\n\n## Kutu Daun (Aphids)\n\nKutu daun biasanya menyerang pucuk tanaman dan bagian bawah daun. Cirinya: daun menguning, keriting, dan ada cairan lengket (honeydew). Cara mengatasi: semprot dengan air sabun ringan atau minyak neem.\n\n## Thrips\n\nThrips adalah hama kecil yang menyebabkan daun bercak perak dan keriting. Serangan parah bisa menghambat pertumbuhan. Gunakan predator alami seperti Amblyseius cucumeris atau semprot spinosad.\n\n## Tungau Laba-laba (Spider Mites)\n\nTungau membuat sarang halus di bawah daun dan menyebabkan bintik kuning. Serangan berat bisa membuat tanaman gundul. Tingkatkan kelembaban udara untuk mencegah tungau.\n\n## Ulat\n\nUat memakan daun dan batang muda. Petik secara manual jika jumlahnya sedikit. Untuk serangan berat, gunakan Bacillus thuringiensis (Bt) yang aman untuk tanaman konsumsi.\n\n## Pencegahan\n\nKebersihan adalah kunci utama. Sterilkan alat tanam, gunakan media tanam baru, dan periksa tanaman setiap hari. Karantina tanaman baru sebelum dicampur dengan tanaman sehat.",
    published: true,
    featured: false,
    image: defaultImage,
  },
  {
    title: "Penyakit Tanaman Hidroponik yang Sering Terjadi",
    excerpt: "Busuk akar, embun tepung, dan layu bakterial adalah penyakit yang sering menyerang tanaman hidroponik. Kenali gejala dan cara mengatasinya.",
    body: "Penyakit pada hidroponik biasanya disebabkan oleh jamur, bakteri, atau virus. Lingkungan yang lembab bisa mempercepat penyebaran penyakit.\n\n## Busuk Akar (Root Rot)\n\nPenyebab utama adalah jamur Pythium dan Phytophthora. Gejala: akar berwarna coklat kehitaman, berlendir, dan berbau. Tanaman layu meskipun nutrisi cukup. Penyebab umum adalah suhu larutan terlalu tinggi (>25°C) dan oksigen rendah.\n\n## Cara Mencegah Busuk Akar\n\nJaga suhu larutan nutrisi di bawah 25°C, pastikan aerasi cukup, dan ganti nutrisi secara teratur. Tambahkan bakteri menguntungkan seperti Trichoderma untuk melindungi akar.\n\n## Embun Tepung (Powdery Mildew)\n\nJamur ini tampak seperti tepung putih pada daun. Penyebabnya kelembaban tinggi dan sirkulasi udara buruk. Atasi dengan meningkatkan ventilasi, mengurangi kelembaban, dan semprot fungisida organik.\n\n## Layu Bakterial\n\nBakteri Pseudomonas atau Erwinia menyebabkan tanaman layu mendadak. Batang yang dipotong akan mengeluarkan lendir bakteri. Tanaman terinfeksi harus segera dimusnahkan untuk mencegah penyebaran.\n\n## Kebersihan Lingkungan\n\nPencegahan terbaik adalah menjaga kebersihan. Bersihkan alat secara rutin, jangan gunakan air yang terkontaminasi, dan pastikan sirkulasi udara baik di sekitar area tanam.",
    published: true,
    featured: false,
    image: defaultImage,
  },
  {
    title: "Pestisida Organik Alami untuk Tanaman Hidroponik",
    excerpt: "Gunakan bahan-bahan alami di sekitar rumah untuk membuat pestisida organik yang aman bagi tanaman dan lingkungan.",
    body: "Pestisida organik dapat dibuat dari bahan-bahan sederhana yang ada di dapur. Selain lebih aman, pestisida organik juga ramah lingkungan.\n\n## Pestisida Bawang Putih\n\nBawang putih mengandung allicin yang bersifat antibakteri dan antifungi. Caranya: haluskan 5 siung bawang putih, rendam dalam 1 liter air selama 24 jam, saring, lalu semprotkan ke tanaman. Efektif untuk kutu daun dan ulat.\n\n## Pestisida Daun Pepaya\n\nDaun pepaya mengandung alkaloid carpaine yang efektif mengusir serangga. Tumbuk 5-7 lembar daun pepaya, campur dengan 1 liter air, diamkan semalaman, saring, dan siap digunakan.\n\n## Pestisida Cabai\n\nCabai mengandung capsaicin yang mengusir hama. Rebus 10 buah cabai rawit dalam 1 liter air, haluskan, saring, dan semprotkan. Sangat efektif untuk kutu kebul dan thrips.\n\n## Minyak Neem\n\nMinyak neem adalah pestisida organik paling efektif untuk hidroponik. Campur 5 ml minyak neem dengan 1 liter air hangat dan sedikit sabun cair. Semprot setiap 7-10 hari untuk pencegahan.\n\n## Tips Aplikasi\n\nSemprot pestisida pada pagi atau sore hari. Hindari penyemprotan saat terik matahari. Lakukan secara rutin untuk hasil optimal. Jangan mencampur beberapa jenis pestisida sekaligus.",
    published: true,
    featured: false,
    image: defaultImage,
  },

  // ADVANCED TECHNIQUES (~2)
  {
    title: "Perbandingan Sistem NFT, DFT, dan Aeroponik",
    excerpt: "Ketiga sistem hidroponik canggih ini punya kelebihan masing-masing. Simak perbandingan lengkapnya untuk memilih yang terbaik.",
    body: "NFT, DFT, dan aeroponik adalah tiga sistem hidroponik yang sering digunakan oleh petani modern. Masing-masing memiliki karakteristik unik.\n\n## NFT (Nutrient Film Technique)\n\nSistem NFT mengalirkan lapisan tipis nutrisi (1-2 mm) di dasar pipa. Akar tanaman terpapar nutrisi dan udara secara bergantian. Kelebihan: irit air, efisien, dan pertumbuhan cepat. Kekurangan: sangat bergantung pada listrik, jika pompa mati tanaman cepat layu.\n\n## DFT (Deep Flow Technique)\n\nSistem DFT menggenangi nutrisi lebih dalam (3-5 cm) sehingga akar selalu terendam. Kelebihan: lebih toleran terhadap mati listrik, nutrisi lebih stabil. Kekurangan: konsumsi listrik lebih besar karena pompa 24 jam, risiko busuk akar lebih tinggi.\n\n## Aeroponik\n\nAkar tanaman digantung di udara dan disemprot nutrisi secara periodik. Kelebihan: oksigenasi maksimal, pertumbuhan sangat cepat. Kekurangan: sistem kompleks, rawan tersumbat, dan biaya tinggi.\n\n## Kesimpulan\n\nUntuk pemula, DFT adalah pilihan paling aman. Untuk skala komersial sayuran daun, NFT adalah standar industri. Untuk tanaman bernilai tinggi atau riset, aeroponik adalah pilihan terbaik.",
    published: true,
    featured: true,
    image: defaultImage,
  },
  {
    title: "Teknik Pembibitan dan Perbanyakan Tanaman Hidroponik",
    excerpt: "Pelajari teknik pembibitan dan perbanyakan tanaman yang akan menghasilkan bibit kuat dan seragam untuk hidroponik.",
    body: "Kualitas bibit sangat menentukan keberhasilan hidroponik. Bibit yang kuat akan tumbuh lebih cepat dan lebih tahan terhadap hama.\n\n## Teknik Penyemaian\n\nGunakan rockwool atau spons sebagai media semai. Basahi media dengan air pH 5.5-6.0. Buat lubang sedalam 0.5-1 cm, masukkan 1-2 benih, dan tutup tipis. Letakkan di tempat lembab dan teduh dengan suhu 22-28°C.\n\n## Stek Batang\n\nBeberapa tanaman seperti kemangi dan mint bisa diperbanyak dengan stek. Potong batang sepanjang 10-15 cm, buang daun bagian bawah, dan rendam dalam air selama 7-14 hari hingga akar muncul. Pindahkan ke sistem hidroponik.\n\n## Aklimatisasi\n\nProses adaptasi bibit dari lingkungan semai ke sistem hidroponik sangat penting. Lakukan secara bertahap: naikkan intensitas cahaya secara perlahan, turunkan kelembaban, dan mulai beri nutrisi setengah dosis.\n\n## Pemilihan Bibit Siap Tanam\n\nBibit siap pindah jika memiliki 4-6 daun sejati, tinggi 5-10 cm, dan akar sudah menembus rockwool. Pilih bibit yang seragam ukurannya untuk pertumbuhan optimal.",
    published: true,
    featured: false,
    image: defaultImage,
  },

  // HARVEST/STORAGE TIPS (~2)
  {
    title: "Waktu Panen yang Tepat untuk Sayuran Hidroponik",
    excerpt: "Memetik sayuran pada waktu yang tepat akan menghasilkan rasa dan tekstur terbaik. Simak panduan waktu panen berbagai sayuran.",
    body: "Menentukan waktu panen yang tepat adalah keterampilan penting dalam hidroponik. Sayuran yang dipetik terlalu muda atau terlalu tua akan menurunkan kualitas.\n\n## Selada\n\nSelada siap panen 30-45 hari setelah semai. Ciri: daun sudah lebar dan membentuk roset, tinggi sekitar 15-20 cm. Panen pagi hari saat daun masih segar dan renyah.\n\n## Bayam\n\nBayam siap panen 20-30 hari setelah semai. Ciri: daun sudah lebar dan tanaman setinggi 15-25 cm. Bayam yang terlalu tua akan berbunga dan daunnya menjadi pahit.\n\n## Pakcoy\n\nPakcoy siap panen 35-45 hari setelah semai. Ciri: pangkal batang melebar (white stem), daun hijau tua mengkilap. Panen sebelum batang mulai memanjang (bolting).\n\n## Kangkung\n\nKangkung bisa dipanen 15-20 hari setelah semai. Ciri: tanaman setinggi 20-30 cm. Potong 5 cm di atas permukaan untuk panen ulang.\n\n## Penyimpanan Hasil Panen\n\nSayuran hidroponik sebaiknya segera dikonsumsi atau disimpan dengan benar. Cuci bersih, tiriskan, simpan dalam wadah tertutup di kulkas (suhu 4-8°C). Sebagian besar sayuran daun bisa bertahan 5-7 hari.",
    published: true,
    featured: false,
    image: defaultImage,
  },
  {
    title: "Tips Menyimpan Sayuran Hidroponik agar Tetap Segar",
    excerpt: "Sayuran hidroponik lebih segar tapi juga lebih sensitif. Simak cara menyimpannya agar tahan lebih lama.",
    body: "Sayuran hidroponik memiliki kadar air tinggi dan tekstur renyah. Penanganan dan penyimpanan yang salah bisa membuatnya cepat layu.\n\n## Persiapan Penyimpanan\n\nJangan cuci sayuran sebelum disimpan, karena kelembaban berlebih akan mempercepat pembusukan. Buang daun yang rusak atau layu. Biarkan sayuran dalam kondisi kering.\n\n## Metode Penyimpanan\n\nBungkus sayuran dengan tisu dapur atau kain bersih untuk menyerap kelembaban berlebih. Masukkan dalam kantong plastik atau wadah kedap udara. Simpan di chiller (4-8°C). Tisu perlu diganti jika lembab.\n\n## Durasi Penyimpanan\n\nSelada dan bayam: 5-7 hari. Pakcoy dan sawi: 7-10 hari. Kangkung: 3-5 hari. Kemangi: 3-5 hari (sebaiknya batang dicelup air seperti bunga). Cabai: 2-3 minggu di suhu ruang atau kulkas.\n\n## Membekukan Sayuran\n\nBeberapa sayuran bisa dibekukan untuk penyimpanan jangka panjang. Blanching (rebus sebentar 1-2 menit) sebelum dibekukan akan mempertahankan kualitas. Bayam dan kangkung cocok untuk dibekukan.\n\n## Tips Tambahan\n\nSimpan sayuran jauh dari buah penghasil etilen seperti apel dan pisang. Etilen akan mempercepat pematangan dan pembusukan sayuran daun.",
    published: true,
    featured: false,
    image: defaultImage,
  },

  // SEASONAL TOPICS (~2)
  {
    title: "Berkebun Hidroponik di Musim Hujan",
    excerpt: "Musim hujan membawa tantangan tersendiri untuk hidroponik. Pelajari cara mengelola tanaman saat curah hujan tinggi.",
    body: "Musim hujan di Indonesia berlangsung sekitar Oktober hingga Maret. Curah hujan tinggi membawa beberapa tantangan bagi pekebun hidroponik.\n\n## Tantangan Musim Hujan\n\nHujan deras bisa mengencerkan nutrisi di sistem outdoor, meningkatkan risiko busuk akar karena suhu lebih dingin, dan memicu pertumbuhan jamur akibat kelembaban tinggi. Selain itu, intensitas cahaya berkurang karena awan tebal.\n\n## Penyesuaian Sistem\n\nJika sistem Anda outdoor, pertimbangkan untuk memindahkan ke tempat teduh atau memasang atap transparan. Tutup reservoir nutrisi agar tidak kemasukan air hujan. Tingkatkan dosis nutrisi sedikit untuk mengompensasi pengenceran.\n\n## Pengaturan Nutrisi\n\nCek pH dan TDS lebih sering saat musim hujan, karena air hujan bisa mengubah komposisi nutrisi. Jika perlu, tambahkan fungisida organik pencegahan untuk mengantisipasi jamur.\n\n## Pemilihan Tanaman\n\nBeberapa tanaman lebih tahan musim hujan: kangkung, bayam, dan sawi hijau. Hindari tanaman yang sensitif terhadap kelembaban tinggi seperti tomat dan cabai jika sistem outdoor.\n\n## Sirkulasi Udara\n\nPastikan sirkulasi udara tetap baik meskipun hujan. Gunakan kipas angin untuk mengurangi kelembaban dan mencegah jamur.",
    published: true,
    featured: false,
    image: defaultImage,
  },
  {
    title: "Berkebun Hidroponik di Musim Kemarau",
    excerpt: "Suhu panas dan udara kering saat kemarau bisa mempengaruhi tanaman hidroponik. Simak tips mengatasinya.",
    body: "Musim kemarau dengan suhu tinggi dan kelembaban rendah membutuhkan penyesuaian dalam perawatan hidroponik.\n\n## Tantangan Musim Kemarau\n\nSuhu larutan nutrisi bisa naik di atas 30°C, mengurangi oksigen terlarut dan memicu busuk akar. Penguapan air lebih cepat, sehingga volume nutrisi berkurang drastis. Tanaman bisa layu meskipun nutrisi cukup.\n\n## Mengelola Suhu\n\nLetakkan reservoir nutrisi di tempat teduh. Gunakan botol beku atau ice pack untuk menurunkan suhu larutan. Tanam di area yang mendapat naungan di siang hari. Pasang paranet 50-70% untuk mengurangi intensitas cahaya.\n\n## Frekuensi Penyiraman\n\nTingkatkan frekuensi sirkulasi nutrisi karena penguapan lebih cepat. Cek volume nutrisi setiap hari dan lakukan top up dengan air bersih. Pantau TDS karena air menguap tapi nutrisi tetap, menyebabkan konsentrasi naik.\n\n## Tanaman yang Cocok\n\nDi musim kemarau, pilih tanaman yang tahan panas: kangkung, bayam, selada romaine, dan cabai. Hindari selada butterhead dan pakcoy yang mudah bolting di suhu tinggi.",
    published: true,
    featured: false,
    image: defaultImage,
  },

  // GENERAL PLANT CARE (~2)
  {
    title: "Pentingnya Sirkulasi Udara untuk Tanaman Hidroponik",
    excerpt: "Sirkulasi udara yang baik mencegah jamur dan membantu pertumbuhan tanaman. Pelajari cara mengaturnya dengan benar.",
    body: "Sirkulasi udara adalah faktor yang sering diabaikan dalam hidroponik. Padahal, udara yang bergerak sangat penting untuk kesehatan tanaman.\n\n## Manfaat Sirkulasi Udara\n\nUdara yang bergerak membantu memperkuat batang tanaman (seperti latihan angin), mencegah jamur dan lumut, membantu penyerbukan, serta mengatur suhu dan kelembaban di sekitar tanaman.\n\n## Cara Mengatur Sirkulasi\n\nGunakan kipas angin kecil atau kipas oscillating yang diarahkan ke tanaman. Jangan terlalu kencang karena bisa merusak daun. Nyalakan 12-24 jam per hari. Untuk greenhouse, gunakan exhaust fan dan intake fan.\n\n## Posisi Kipas\n\nLetakkan kipas di atas tanaman atau di samping dengan sudut 45 derajat. Pastikan udara mengalir di antara daun-daun tanaman. Jangan langsung meniup ke media tanam atau akar.\n\n## Sirkulasi di Indoor\n\nUntuk hidroponik indoor, sirkulasi udara sangat krusial karena ruangan tertutup. Kombinasikan kipas dengan exhaust fan untuk membuang udara panas dan menarik udara segar dari luar.",
    published: true,
    featured: false,
    image: defaultImage,
  },
  {
    title: "Cara Membersihkan dan Merawat Sistem Hidroponik",
    excerpt: "Sistem hidroponik perlu dibersihkan secara rutin untuk mencegah pertumbuhan jamur dan bakteri. Simak panduan perawatannya.",
    body: "Kebersihan sistem hidroponik adalah fondasi keberhasilan jangka panjang. Sistem yang kotor menjadi sarang patogen yang bisa merusak tanaman.\n\n## Frekuensi Pembersihan\n\nGanti larutan nutrisi setiap 1-2 minggu. Bersihkan reservoir setiap kali ganti nutrisi. Bersihkan seluruh sistem setiap 1-2 bulan tergantung kondisi.\n\n## Cara Membersihkan Reservoir\n\nKosongkan reservoir, gosok dengan spons bersih dan air hangat. Jangan gunakan sabun atau deterjen karena residunya berbahaya bagi tanaman. Jika ada lumut, gunakan hidrogen peroksida (H2O2) 3% untuk membersihkan.\n\n## Membersihkan Pipa dan Selang\n\nGunakan sikat pipa (pipe cleaner) atau sikat botol untuk membersihkan bagian dalam pipa. Alirkan air bersih dengan tekanan. Jika ada sumbatan, gunakan tusuk gigi atau kawat lembut.\n\n## Merawat Pompa\n\nBongkar pompa setiap 2-3 bulan untuk membersihkan impeller dan housing dari endapan. Rendam bagian pompa dalam campuran air dan cuka (1:5) selama 30 menit untuk melarutkan kerak.\n\n## Sterilisasi Alat\n\nUntuk sterilisasi menyeluruh, gunakan larutan hidrogen peroksida 3% atau klorin 10 ppm. Bilas hingga bersih sebelum digunakan kembali. Pastikan tidak ada residu bahan kimia yang tertinggal.",
    published: true,
    featured: false,
    image: defaultImage,
  },
]

export default seedData
