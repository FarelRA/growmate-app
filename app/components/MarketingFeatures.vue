<script setup lang="ts">
import { computed } from 'vue'

const proofCards = computed(() => [
  {
    title: 'Pendampingan yang mudah dipahami',
    detail:
      'Pengguna dibantu memahami apa yang perlu dilakukan sejak awal tanam hingga masa panen tanpa harus menebak kondisi tanaman.',
    icon: 'verified',
  },
  {
    title: 'Budidaya lebih konsisten',
    detail:
      'Pemantauan kondisi dan alur perawatan membantu menjaga tanaman tetap produktif serta mengurangi risiko perawatan yang terlewat.',
    icon: 'routine',
  },
  {
    title: 'Komunitas dan pasar dalam satu tempat',
    detail:
      'Pengguna dapat belajar dari pengalaman sesama petani sekaligus membuka peluang distribusi hasil panen secara langsung.',
    icon: 'favorite',
  },
  {
    title: 'Lebih hemat waktu dan tenaga',
    detail:
      'Pemantauan, penyiraman, dan keputusan harian menjadi lebih praktis karena dibantu data lapangan dan otomatisasi.',
    icon: 'eco',
  },
])
</script>

<template>
  <section class="bg-[#f4efe6] py-16 lg:py-24">
    <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <RevealBlock
        as="h2"
        class="mb-16 text-center font-headline text-3xl text-gray-900 lg:text-4xl"
      >
        Mengapa GrowMate Relevan untuk Pengguna
      </RevealBlock>

      <div class="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
        <RevealBlock
          v-for="(card, index) in proofCards"
          :key="card.title"
          as="div"
          :delay="index * 90"
          origin="up"
          class="gm-card-lift text-center"
        >
          <div
            class="mx-auto mb-4 flex h-20 w-20 items-center justify-center text-gray-800"
          >
            <span class="material-symbols-outlined gm-proof-icon">{{ card.icon }}</span>
          </div>
          <h3 class="mb-2 text-base font-semibold text-gray-900">{{ card.title }}</h3>
          <p class="text-sm text-gray-600">{{ card.detail }}</p>
        </RevealBlock>
      </div>
    </div>
  </section>
</template>
