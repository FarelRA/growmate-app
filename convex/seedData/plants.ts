// Seed dataset — hand-maintained. Image bytes live in public/seed-images/<hash>/;
// this module carries only content hashes (see convex/seed/images.ts).
import type { PlantSeedData } from './types'

const seedData: PlantSeedData[] = [
  {
    key: "kemangi",
    name: "Kemangi",
    species: "Ocimum basilicum",
    description: "Kemangi adalah tanaman herba aromatik yang populer dalam masakan Asia Tenggara. Daunnya yang harum sering digunakan sebagai lalapan atau pelengkap hidangan. Tanaman ini tumbuh cepat dan mudah dirawat, cocok untuk pemula yang ingin belajar bercocok tanam hidroponik.",
    location: "Asia Tenggara",
    category: "herb",
    difficulty: "easy",
    wateringThreshold: 70,
    lightingThreshold: 70,
    fertilizingThreshold: 35,
    fertilizerCadenceDays: 7,
    pesticideCadenceDays: 14,
    nutrientNotes: 'Pupuk NPK seimbang setiap minggu. Responsif terhadap pemupukan nitrogen saat fase vegetatif.',
    sensorProfile: {
          "soil": {
                "min": 60,
                "max": 80
          },
          "light": {
                "min": 60,
                "max": 80
          },
          "temperature": {
                "min": 20,
                "max": 30
          },
          "air": {
                "min": 50,
                "max": 70
          },
          "water": {
                "min": 60,
                "max": 80
          }
    },
    lifecycleProfile: {
          "seedDormancyDays": 5,
          "germinationDays": 7,
          "seedlingDevelopmentDays": 14,
          "vegetativeGrowthDays": 30,
          "floweringReproductionDays": 60,
          "maturitySenescenceDays": 80
    },
    image: { hash: "2754a45b3d44c4d6" },
  },
  {
    key: "selada",
    name: "Selada",
    species: "Lactuca sativa",
    description: "Selada adalah sayuran daun yang sangat cocok ditanam secara hidroponik. Pertumbuhannya cepat dan dapat dipanen dalam waktu 30-45 hari setelah tanam. Selada kaya akan vitamin dan mineral, serta menjadi bahan dasar berbagai salad sehat.",
    location: "Asia, Eropa, Amerika",
    category: "leafy",
    difficulty: "easy",
    wateringThreshold: 60,
    lightingThreshold: 50,
    fertilizingThreshold: 30,
    fertilizerCadenceDays: 10,
    pesticideCadenceDays: 14,
    nutrientNotes: 'Pupuk nitrogen ringan setiap 10 hari. Hindari kelebihan pupuk yang menyebabkan daun pahit.',
    sensorProfile: {
          "soil": {
                "min": 50,
                "max": 70
          },
          "light": {
                "min": 40,
                "max": 60
          },
          "temperature": {
                "min": 15,
                "max": 25
          },
          "air": {
                "min": 50,
                "max": 70
          },
          "water": {
                "min": 60,
                "max": 80
          }
    },
    lifecycleProfile: {
          "seedDormancyDays": 3,
          "germinationDays": 5,
          "seedlingDevelopmentDays": 10,
          "vegetativeGrowthDays": 25,
          "floweringReproductionDays": 50,
          "maturitySenescenceDays": 60
    },
    image: { hash: "5e2974eb81cc1072" },
  },
  {
    key: "bayam",
    name: "Bayam",
    species: "Amaranthus hybridus",
    description: "Bayam adalah sayuran daun bergizi tinggi yang mudah dibudidayakan secara hidroponik. Kaya akan zat besi, kalsium, dan vitamin A. Bayam tumbuh cepat dan dapat dipanen berulang kali dengan memotong batangnya.",
    location: "Asia Tenggara",
    category: "leafy",
    difficulty: "easy",
    wateringThreshold: 60,
    lightingThreshold: 50,
    fertilizingThreshold: 30,
    fertilizerCadenceDays: 10,
    pesticideCadenceDays: 14,
    nutrientNotes: 'Pupuk nitrogen tinggi setiap 10 hari untuk pertumbuhan daun optimal.',
    sensorProfile: {
          "soil": {
                "min": 50,
                "max": 70
          },
          "light": {
                "min": 40,
                "max": 60
          },
          "temperature": {
                "min": 15,
                "max": 25
          },
          "air": {
                "min": 50,
                "max": 70
          },
          "water": {
                "min": 60,
                "max": 80
          }
    },
    lifecycleProfile: {
          "seedDormancyDays": 5,
          "germinationDays": 7,
          "seedlingDevelopmentDays": 12,
          "vegetativeGrowthDays": 25,
          "floweringReproductionDays": 45,
          "maturitySenescenceDays": 55
    },
    image: { hash: "b55428c3751a70c5" },
  },
  {
    key: "pakcoy",
    name: "Pakcoy",
    species: "Brassica rapa subsp. chinensis",
    description: "Pakcoy atau bok choy adalah sayuran hijau yang populer dalam masakan Asia. Tanaman ini tumbuh subur di sistem hidroponik dan memiliki siklus panen yang relatif singkat. Batangnya renyah dan daunnya lembut, kaya akan vitamin C dan K.",
    location: "Asia Timur",
    category: "leafy",
    difficulty: "easy",
    wateringThreshold: 60,
    lightingThreshold: 50,
    fertilizingThreshold: 35,
    fertilizerCadenceDays: 7,
    pesticideCadenceDays: 14,
    nutrientNotes: 'Pupuk NPK seimbang setiap minggu. Responsif terhadap pupuk nitrogen.',
    sensorProfile: {
          "soil": {
                "min": 50,
                "max": 70
          },
          "light": {
                "min": 40,
                "max": 60
          },
          "temperature": {
                "min": 15,
                "max": 22
          },
          "air": {
                "min": 55,
                "max": 75
          },
          "water": {
                "min": 60,
                "max": 80
          }
    },
    lifecycleProfile: {
          "seedDormancyDays": 3,
          "germinationDays": 5,
          "seedlingDevelopmentDays": 10,
          "vegetativeGrowthDays": 28,
          "floweringReproductionDays": 45,
          "maturitySenescenceDays": 55
    },
    image: { hash: "b287ae68c18f47a4" },
  },
  {
    key: "cabai-rawit",
    name: "Cabai Rawit",
    species: "Capsicum frutescens",
    description: "Cabai rawit adalah varietas cabai pedas yang banyak digunakan dalam masakan Indonesia. Tanaman ini membutuhkan sinar matahari penuh dan suhu hangat untuk berbuah optimal. Dalam sistem hidroponik, cabai rawit dapat menghasilkan buah sepanjang tahun.",
    location: "Asia Tenggara",
    category: "fruiting",
    difficulty: "medium",
    wateringThreshold: 60,
    lightingThreshold: 80,
    fertilizingThreshold: 40,
    fertilizerCadenceDays: 5,
    pesticideCadenceDays: 10,
    nutrientNotes: 'Pupuk tinggi kalium dan fosfor setiap 5 hari saat fase berbuah. Kurangi nitrogen saat berbunga.',
    sensorProfile: {
          "soil": {
                "min": 50,
                "max": 70
          },
          "light": {
                "min": 70,
                "max": 90
          },
          "temperature": {
                "min": 22,
                "max": 30
          },
          "air": {
                "min": 40,
                "max": 60
          },
          "water": {
                "min": 50,
                "max": 70
          }
    },
    lifecycleProfile: {
          "seedDormancyDays": 7,
          "germinationDays": 10,
          "seedlingDevelopmentDays": 21,
          "vegetativeGrowthDays": 40,
          "floweringReproductionDays": 70,
          "maturitySenescenceDays": 100
    },
    image: { hash: "424cd1e34b6555b0" },
  },
  {
    key: "tomat-ceri",
    name: "Tomat Ceri",
    species: "Solanum lycopersicum var. cerasiforme",
    description: "Tomat ceri adalah varietas tomat berukuran kecil dengan rasa manis yang cocok ditanam secara hidroponik. Tanaman merambat ini menghasilkan buah dalam jumlah banyak sepanjang siklus hidupnya. Cocok untuk dipanen segar sebagai camilan atau campuran salad.",
    location: "Amerika Selatan",
    category: "fruiting",
    difficulty: "medium",
    wateringThreshold: 60,
    lightingThreshold: 80,
    fertilizingThreshold: 40,
    fertilizerCadenceDays: 5,
    pesticideCadenceDays: 10,
    nutrientNotes: 'Pupuk tinggi kalium dan kalsium setiap 5 hari saat berbuah. Hindari kelebihan nitrogen.',
    sensorProfile: {
          "soil": {
                "min": 50,
                "max": 70
          },
          "light": {
                "min": 70,
                "max": 90
          },
          "temperature": {
                "min": 20,
                "max": 28
          },
          "air": {
                "min": 40,
                "max": 60
          },
          "water": {
                "min": 50,
                "max": 70
          }
    },
    lifecycleProfile: {
          "seedDormancyDays": 5,
          "germinationDays": 8,
          "seedlingDevelopmentDays": 18,
          "vegetativeGrowthDays": 35,
          "floweringReproductionDays": 65,
          "maturitySenescenceDays": 90
    },
    image: { hash: "cd80d45348e20603" },
  },
  {
    key: "stroberi",
    name: "Stroberi",
    species: "Fragaria × ananassa",
    description: "Stroberi adalah tanaman buah yang banyak diminati dan dapat ditanam secara hidroponik dengan hasil memuaskan. Meskipun membutuhkan perawatan lebih intensif, rasa buah yang manis dan segar sebanding dengan usaha yang dikeluarkan. Cocok untuk pekebun tingkat menengah hingga mahir.",
    location: "Amerika, Eropa",
    category: "fruiting",
    difficulty: "advanced",
    wateringThreshold: 70,
    lightingThreshold: 70,
    fertilizingThreshold: 40,
    fertilizerCadenceDays: 5,
    pesticideCadenceDays: 10,
    nutrientNotes: 'Pupuk tinggi fosfor dan kalium setiap 5 hari saat berbunga dan berbuah.',
    sensorProfile: {
          "soil": {
                "min": 50,
                "max": 70
          },
          "light": {
                "min": 60,
                "max": 80
          },
          "temperature": {
                "min": 15,
                "max": 25
          },
          "air": {
                "min": 50,
                "max": 70
          },
          "water": {
                "min": 60,
                "max": 80
          }
    },
    lifecycleProfile: {
          "seedDormancyDays": 14,
          "germinationDays": 21,
          "seedlingDevelopmentDays": 30,
          "vegetativeGrowthDays": 50,
          "floweringReproductionDays": 80,
          "maturitySenescenceDays": 120
    },
    image: { hash: "7fdca9d1aeb76d87" },
  },
  {
    key: "mint",
    name: "Mint",
    species: "Mentha spicata",
    description: "Mint adalah tanaman herba aromatik yang sangat mudah tumbuh dan cepat menyebar. Daunnya menyegarkan dan sering digunakan untuk minuman, masakan, atau obat herbal. Dalam sistem hidroponik, mint tumbuh subur dengan perawatan minimal dan dapat dipanen berulang kali.",
    location: "Eropa, Asia",
    category: "herb",
    difficulty: "easy",
    wateringThreshold: 60,
    lightingThreshold: 50,
    fertilizingThreshold: 35,
    fertilizerCadenceDays: 7,
    pesticideCadenceDays: 14,
    nutrientNotes: 'Pupuk NPK seimbang setiap minggu. Tumbuh agresif, responsif terhadap pupuk.',
    sensorProfile: {
          "soil": {
                "min": 50,
                "max": 70
          },
          "light": {
                "min": 40,
                "max": 60
          },
          "temperature": {
                "min": 18,
                "max": 25
          },
          "air": {
                "min": 50,
                "max": 70
          },
          "water": {
                "min": 60,
                "max": 80
          }
    },
    lifecycleProfile: {
          "seedDormancyDays": 7,
          "germinationDays": 10,
          "seedlingDevelopmentDays": 15,
          "vegetativeGrowthDays": 30,
          "floweringReproductionDays": 55,
          "maturitySenescenceDays": 70
    },
    image: { hash: "ca886bf93c89ccd9" },
  },
  {
    key: "rosemary",
    name: "Rosemary",
    species: "Salvia rosmarinus",
    description: "Rosemary adalah tanaman herba Mediterania yang dikenal dengan aroma khasnya. Tanaman ini membutuhkan sinar matahari penuh dan drainase yang baik. Rosemary sering digunakan sebagai bumbu masakan Eropa dan memiliki banyak manfaat kesehatan.",
    location: "Mediterania",
    category: "herb",
    difficulty: "medium",
    wateringThreshold: 40,
    lightingThreshold: 80,
    fertilizingThreshold: 30,
    fertilizerCadenceDays: 14,
    pesticideCadenceDays: 14,
    nutrientNotes: 'Pupuk rendah nitrogen setiap 2 minggu. Pemupukan berlebihan menyebabkan pertumbuhan leggy.',
    sensorProfile: {
          "soil": {
                "min": 30,
                "max": 50
          },
          "light": {
                "min": 70,
                "max": 90
          },
          "temperature": {
                "min": 20,
                "max": 30
          },
          "air": {
                "min": 40,
                "max": 60
          },
          "water": {
                "min": 30,
                "max": 50
          }
    },
    lifecycleProfile: {
          "seedDormancyDays": 14,
          "germinationDays": 21,
          "seedlingDevelopmentDays": 30,
          "vegetativeGrowthDays": 60,
          "floweringReproductionDays": 90,
          "maturitySenescenceDays": 150
    },
    image: { hash: "cef1a372d1588604" },
  },
  {
    key: "lidah-mertua",
    name: "Lidah Mertua",
    species: "Dracaena trifasciata",
    description: "Lidah mertua atau snake plant adalah tanaman hias populer yang sangat mudah dirawat. Tanaman ini dikenal sebagai pembersih udara alami karena mampu menyerap racun di udara. Cocok untuk pekebun pemula karena toleran terhadap berbagai kondisi lingkungan.",
    location: "Afrika Barat",
    category: "houseplant",
    difficulty: "easy",
    wateringThreshold: 30,
    lightingThreshold: 30,
    fertilizingThreshold: 25,
    fertilizerCadenceDays: 30,
    pesticideCadenceDays: 60,
    nutrientNotes: 'Pemupukan ringan setiap bulan selama musim tanam. Gunakan pupuk NPK seimbang dengan dosis 1/4 dari dosis normal.',
    sensorProfile: {
          "soil": {
                "min": 20,
                "max": 40
          },
          "light": {
                "min": 20,
                "max": 40
          },
          "temperature": {
                "min": 18,
                "max": 30
          },
          "air": {
                "min": 30,
                "max": 50
          },
          "water": {
                "min": 20,
                "max": 40
          }
    },
    lifecycleProfile: {
          "seedDormancyDays": 21,
          "germinationDays": 30,
          "seedlingDevelopmentDays": 45,
          "vegetativeGrowthDays": 90,
          "floweringReproductionDays": 180,
          "maturitySenescenceDays": 365
    },
    image: { hash: "5fd5992256ddd19c" },
  },
]

export default seedData
