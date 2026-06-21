<script setup lang="ts">
defineProps<{
  devices: { deviceId: string; name: string; isOnline: boolean; plant: { name: string; species: string } | null; archivedPlants: { _id: string; name: string; archivedAtLabel: string | null }[] }[]
  currentDeviceId: string | undefined
  removingDeviceId: string | null
}>()

defineEmits<{
  selectDevice: [deviceId: string]
  selectPlant: [deviceId?: string]
  removeDevice: [deviceId: string, name: string]
  connectDevice: []
}>()
</script>

<template>
  <section class="space-y-4">
    <article class="rounded-[2rem] bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
      <p class="text-xs font-bold uppercase tracking-[0.2em] text-gm-primary">Armada</p>
      <h1 class="mt-2 font-headline text-3xl font-black tracking-tight text-gm-text">Pod GrowMate Anda</h1>
      <p class="mt-3 text-sm leading-relaxed text-gm-muted">Kelola perangkat dan arsip perangkat Anda, tambah atau hapus, serta ganti tanamannya.</p>
      <div class="mt-5 flex flex-wrap gap-3">
        <button type="button" class="rounded-full bg-gm-primary px-5 py-3 text-sm font-bold text-white" @click="$emit('connectDevice')">
          Hubungkan perangkat lain
        </button>
      </div>
    </article>

    <div class="space-y-4">
      <article
        v-for="device in devices"
        :key="device.deviceId"
        class="rounded-[2rem] bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)]"
      >
        <div class="flex flex-col gap-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <h2 class="font-headline text-2xl font-black tracking-tight text-gm-text">{{ device.name }}</h2>
              <p class="mt-1 text-sm text-gm-muted">{{ device.deviceId }}</p>
            </div>
            <div class="flex flex-col items-end gap-2">
              <span
                class="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em]"
                :class="device.deviceId === currentDeviceId ? 'bg-gm-primary text-white' : 'bg-[#f3f3f3] text-gm-muted'"
              >
                {{ device.deviceId === currentDeviceId ? 'Aktif' : 'Siaga' }}
              </span>
              <span
                class="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em]"
                :class="device.isOnline ? 'bg-[#94f990]/35 text-[#005313]' : 'bg-[#e8e8e8] text-gm-muted'"
              >
                {{ device.isOnline ? 'Terhubung' : 'Tidak terhubung' }}
              </span>
            </div>
          </div>

          <div v-if="device.plant" class="rounded-[1.5rem] bg-[#f3f3f3] p-4">
            <div class="text-xs font-bold uppercase tracking-[0.18em] text-gm-muted">Tanaman saat ini</div>
            <div class="mt-2 text-lg font-bold text-gm-text">{{ device.plant.name }}</div>
            <div class="mt-1 text-sm text-gm-muted">{{ device.plant.species }}</div>
          </div>
          <div v-else class="rounded-[1.5rem] bg-[#f3f3f3] p-4 text-sm text-gm-muted">Perangkat ini sudah diklaim tetapi masih menunggu profil tanaman.</div>

          <div v-if="device.archivedPlants?.length" class="space-y-2">
            <div class="text-xs font-bold uppercase tracking-[0.18em] text-gm-muted">Arsip terbaru</div>
            <div class="grid gap-2 sm:grid-cols-2">
              <div
                v-for="plant in device.archivedPlants"
                :key="plant._id"
                class="rounded-[1.25rem] bg-[#f3f3f3] p-3"
              >
                <div class="text-sm font-bold text-gm-text">{{ plant.name }}</div>
                <div class="mt-1 text-xs text-gm-muted">Diarsipkan {{ plant.archivedAtLabel }}</div>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <button type="button" class="rounded-full bg-[#f3f3f3] px-4 py-3 text-sm font-bold text-gm-text" @click="$emit('selectDevice', device.deviceId)">
              Jadikan aktif
            </button>
            <button type="button" class="rounded-full bg-gradient-to-r from-gm-primary to-gm-primary-soft px-4 py-3 text-sm font-bold text-white" @click="$emit('selectPlant', device.deviceId)">
              {{ device.plant ? 'Ganti tanaman' : 'Pilih tanaman' }}
            </button>
            <button
              type="button"
              class="rounded-full bg-[#ffdbcf] px-4 py-3 text-sm font-bold text-[#795548] disabled:opacity-50"
              :disabled="removingDeviceId === device.deviceId"
              @click="$emit('removeDevice', device.deviceId, device.name)"
            >
              {{ removingDeviceId === device.deviceId ? 'Menghapus...' : 'Hapus' }}
            </button>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>
