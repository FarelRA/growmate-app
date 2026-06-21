<script setup lang="ts">
defineProps<{
  supportQueue: { _id: string; topic: string; userName: string; priority: string; status: string }[]
  devices: { _id: string; name: string; deviceId: string; ownerName: string | null }[]
  recentEvents: { _id: string; title: string; detail?: string; relativeTime: string; timestampLabel: string }[]
}>()
defineEmits<{
  editDevice: [device: { _id: string; name: string; deviceId: string; firmwareVersion: string; autoWatering: boolean; autoLighting: boolean; wateringThreshold: number; wateringDuration: number; wateringCooldown: number; lightingThreshold: number; lightingHysteresis: number }]
}>()
</script>

<template>
  <section class="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
    <article class="rounded-[2rem] bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
      <h2 class="font-headline text-2xl font-bold text-gm-text">Antrian prioritas</h2>
      <div class="mt-5 space-y-3">
        <div v-for="request in supportQueue.slice(0, 5)" :key="request._id" class="rounded-[1.5rem] bg-[#f3f3f3] p-4">
          <div class="text-sm font-bold text-gm-text">{{ request.topic }}</div>
          <div class="mt-1 text-xs uppercase tracking-[0.18em] text-gm-muted">{{ request.userName }} • {{ request.priority }} • {{ request.status.replaceAll('_', ' ') }}</div>
        </div>
        <div v-if="!supportQueue.length" class="rounded-[1.5rem] bg-[#f3f3f3] p-4 text-sm text-gm-muted">Tidak ada tiket dukungan terbuka.</div>
      </div>
    </article>
    <article class="rounded-[2rem] bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
      <h2 class="font-headline text-2xl font-bold text-gm-text">Perangkat terbaru</h2>
      <div class="mt-5 space-y-3">
        <div v-for="device in devices.slice(0, 5)" :key="device._id" class="rounded-[1.5rem] bg-[#f3f3f3] p-4">
          <div class="flex items-center justify-between gap-3">
            <div>
              <div class="text-sm font-bold text-gm-text">{{ device.name }}</div>
              <div class="mt-1 text-xs text-gm-muted">{{ device.deviceId }} • {{ device.ownerName || 'Belum diklaim' }}</div>
            </div>
            <button class="rounded-full bg-white px-4 py-2 text-xs font-bold text-gm-text" @click="$emit('editDevice', device)">Edit</button>
          </div>
        </div>
      </div>
    </article>
    <article class="rounded-[2rem] bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)] lg:col-span-2">
      <h2 class="font-headline text-2xl font-bold text-gm-text">Aktivitas operasional terbaru</h2>
      <div class="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <div v-for="event in recentEvents" :key="event._id" class="rounded-[1.5rem] bg-[#f3f3f3] p-4">
          <div class="text-sm font-bold text-gm-text">{{ event.title }}</div>
          <div v-if="event.detail" class="mt-1 text-sm text-gm-muted">{{ event.detail }}</div>
          <div class="mt-2 text-[11px] text-gm-muted">{{ event.relativeTime }} • {{ event.timestampLabel }}</div>
        </div>
      </div>
    </article>
  </section>
</template>
