<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any */
const props = defineProps<{
  deviceForm: {
    existingDeviceId: string | null
    deviceId: string
    name: string
    firmwareVersion: string
    autoWatering: boolean
    autoLighting: boolean
    wateringThreshold: number
    wateringDuration: number
    wateringCooldown: number
    lightingThreshold: number
    lightingHysteresis: number
    version: 'v1' | 'v2'
    autoFertilizing: boolean
    autoPesticide: boolean
    fertilizingThreshold: number
    fertilizingDuration: number
    fertilizingCooldown: number
    pesticideThreshold: number
    pesticideDuration: number
    pesticideCooldown: number
    tankCapacity: number
    batteryCapacityAh: number
    hasModem: boolean
    hasSolarPanel: boolean
  }
  savingDevice: boolean
  deletingDeviceId: string | null
  devices: any[]
  plantPresets: unknown[]
}>()
const emit = defineEmits<{
  saveDevice: []
  deleteDevice: [id: string]
  editDevice: [device: any]
  resetDeviceForm: []
  'update:deviceForm': [form: { existingDeviceId: string | null; deviceId: string; name: string; firmwareVersion: string; autoWatering: boolean; autoLighting: boolean; wateringThreshold: number; wateringDuration: number; wateringCooldown: number; lightingThreshold: number; lightingHysteresis: number; version: 'v1' | 'v2'; autoFertilizing: boolean; autoPesticide: boolean; fertilizingThreshold: number; fertilizingDuration: number; fertilizingCooldown: number; pesticideThreshold: number; pesticideDuration: number; pesticideCooldown: number; tankCapacity: number; batteryCapacityAh: number; hasModem: boolean; hasSolarPanel: boolean }]
}>()
</script>

<template>
  <section class="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
    <article class="rounded-[2rem] bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
      <div class="flex items-center justify-between gap-3">
        <h2 class="font-headline text-2xl font-bold text-gm-text">{{ props.deviceForm.existingDeviceId ? 'Edit perangkat' : 'Tambah perangkat' }}</h2>
        <button v-if="props.deviceForm.existingDeviceId" class="rounded-full bg-[#f3f3f3] px-4 py-2 text-xs font-bold text-gm-text" @click="emit('resetDeviceForm')">Batal</button>
      </div>
      <div class="mt-5 grid gap-3">
        <label class="space-y-2"><span class="block text-sm font-semibold text-gm-text">ID Perangkat</span><input :value="props.deviceForm.deviceId" class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" placeholder="Contoh: GM-001" @input="emit('update:deviceForm', { ...props.deviceForm, deviceId: ($event.target as HTMLInputElement).value })" /></label>
        <label class="space-y-2"><span class="block text-sm font-semibold text-gm-text">Nama perangkat</span><input :value="props.deviceForm.name" class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" placeholder="Nama perangkat" @input="emit('update:deviceForm', { ...props.deviceForm, name: ($event.target as HTMLInputElement).value })" /></label>
        <label class="space-y-2"><span class="block text-sm font-semibold text-gm-text">Versi firmware</span><input :value="props.deviceForm.firmwareVersion" class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" placeholder="v1.0.0" @input="emit('update:deviceForm', { ...props.deviceForm, firmwareVersion: ($event.target as HTMLInputElement).value })" /></label>
        <label class="space-y-2"><span class="block text-sm font-semibold text-gm-text">Versi perangkat</span>
          <select :value="props.deviceForm.version" class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" @change="emit('update:deviceForm', { ...props.deviceForm, version: ($event.target as HTMLSelectElement).value as 'v1' | 'v2' })">
            <option value="v1">V1</option>
            <option value="v2">V2</option>
          </select>
        </label>
        <div class="grid gap-3 sm:grid-cols-2">
          <label class="space-y-2"><span class="block text-sm font-semibold text-gm-text">Ambang penyiraman</span><input :value="props.deviceForm.wateringThreshold" type="number" class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" @input="emit('update:deviceForm', { ...props.deviceForm, wateringThreshold: Number(($event.target as HTMLInputElement).value) })" /></label>
          <label class="space-y-2"><span class="block text-sm font-semibold text-gm-text">Durasi penyiraman (dtk)</span><input :value="props.deviceForm.wateringDuration" type="number" class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" @input="emit('update:deviceForm', { ...props.deviceForm, wateringDuration: Number(($event.target as HTMLInputElement).value) })" /></label>
          <label class="space-y-2"><span class="block text-sm font-semibold text-gm-text">Cooldown (dtk)</span><input :value="props.deviceForm.wateringCooldown" type="number" class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" @input="emit('update:deviceForm', { ...props.deviceForm, wateringCooldown: Number(($event.target as HTMLInputElement).value) })" /></label>
          <label class="space-y-2"><span class="block text-sm font-semibold text-gm-text">Ambang cahaya</span><input :value="props.deviceForm.lightingThreshold" type="number" class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" @input="emit('update:deviceForm', { ...props.deviceForm, lightingThreshold: Number(($event.target as HTMLInputElement).value) })" /></label>
          <label class="space-y-2"><span class="block text-sm font-semibold text-gm-text">Histeresis cahaya</span><input :value="props.deviceForm.lightingHysteresis" type="number" class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" @input="emit('update:deviceForm', { ...props.deviceForm, lightingHysteresis: Number(($event.target as HTMLInputElement).value) })" /></label>
        </div>
        <label class="mt-2 flex items-center gap-2 rounded-full bg-[#f3f3f3] px-4 py-3 text-sm font-semibold text-gm-text"><input :checked="props.deviceForm.autoWatering" type="checkbox" @change="emit('update:deviceForm', { ...props.deviceForm, autoWatering: ($event.target as HTMLInputElement).checked })" /> Penyiraman otomatis</label>
        <label class="flex items-center gap-2 rounded-full bg-[#f3f3f3] px-4 py-3 text-sm font-semibold text-gm-text"><input :checked="props.deviceForm.autoLighting" type="checkbox" @change="emit('update:deviceForm', { ...props.deviceForm, autoLighting: ($event.target as HTMLInputElement).checked })" /> Pencahayaan otomatis</label>
        <template v-if="props.deviceForm.version === 'v2'">
          <div class="grid gap-3 sm:grid-cols-2">
            <label class="space-y-2"><span class="block text-sm font-semibold text-gm-text">Ambang pupuk (%)</span><input :value="props.deviceForm.fertilizingThreshold" type="number" class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" @input="emit('update:deviceForm', { ...props.deviceForm, fertilizingThreshold: Number(($event.target as HTMLInputElement).value) })" /></label>
            <label class="space-y-2"><span class="block text-sm font-semibold text-gm-text">Durasi pupuk (dtk)</span><input :value="props.deviceForm.fertilizingDuration" type="number" class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" @input="emit('update:deviceForm', { ...props.deviceForm, fertilizingDuration: Number(($event.target as HTMLInputElement).value) })" /></label>
            <label class="space-y-2"><span class="block text-sm font-semibold text-gm-text">Cooldown pupuk (dtk)</span><input :value="props.deviceForm.fertilizingCooldown" type="number" class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" @input="emit('update:deviceForm', { ...props.deviceForm, fertilizingCooldown: Number(($event.target as HTMLInputElement).value) })" /></label>
            <label class="space-y-2"><span class="block text-sm font-semibold text-gm-text">Ambang pestisida (%)</span><input :value="props.deviceForm.pesticideThreshold" type="number" class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" @input="emit('update:deviceForm', { ...props.deviceForm, pesticideThreshold: Number(($event.target as HTMLInputElement).value) })" /></label>
            <label class="space-y-2"><span class="block text-sm font-semibold text-gm-text">Durasi pestisida (dtk)</span><input :value="props.deviceForm.pesticideDuration" type="number" class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" @input="emit('update:deviceForm', { ...props.deviceForm, pesticideDuration: Number(($event.target as HTMLInputElement).value) })" /></label>
            <label class="space-y-2"><span class="block text-sm font-semibold text-gm-text">Cooldown pestisida (dtk)</span><input :value="props.deviceForm.pesticideCooldown" type="number" class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" @input="emit('update:deviceForm', { ...props.deviceForm, pesticideCooldown: Number(($event.target as HTMLInputElement).value) })" /></label>
            <label class="space-y-2"><span class="block text-sm font-semibold text-gm-text">Kapasitas tangki (L)</span><input :value="props.deviceForm.tankCapacity" type="number" class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" @input="emit('update:deviceForm', { ...props.deviceForm, tankCapacity: Number(($event.target as HTMLInputElement).value) })" /></label>
            <label class="space-y-2"><span class="block text-sm font-semibold text-gm-text">Baterai (Ah)</span><input :value="props.deviceForm.batteryCapacityAh" type="number" class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" @input="emit('update:deviceForm', { ...props.deviceForm, batteryCapacityAh: Number(($event.target as HTMLInputElement).value) })" /></label>
          </div>
          <label class="flex items-center gap-2 rounded-full bg-[#f3f3f3] px-4 py-3 text-sm font-semibold text-gm-text"><input :checked="props.deviceForm.autoFertilizing" type="checkbox" @change="emit('update:deviceForm', { ...props.deviceForm, autoFertilizing: ($event.target as HTMLInputElement).checked })" /> Pemupukan otomatis</label>
          <label class="flex items-center gap-2 rounded-full bg-[#f3f3f3] px-4 py-3 text-sm font-semibold text-gm-text"><input :checked="props.deviceForm.autoPesticide" type="checkbox" @change="emit('update:deviceForm', { ...props.deviceForm, autoPesticide: ($event.target as HTMLInputElement).checked })" /> Pestisida otomatis</label>
          <label class="flex items-center gap-2 rounded-full bg-[#f3f3f3] px-4 py-3 text-sm font-semibold text-gm-text"><input :checked="props.deviceForm.hasModem" type="checkbox" @change="emit('update:deviceForm', { ...props.deviceForm, hasModem: ($event.target as HTMLInputElement).checked })" /> Modem seluler</label>
          <label class="flex items-center gap-2 rounded-full bg-[#f3f3f3] px-4 py-3 text-sm font-semibold text-gm-text"><input :checked="props.deviceForm.hasSolarPanel" type="checkbox" @change="emit('update:deviceForm', { ...props.deviceForm, hasSolarPanel: ($event.target as HTMLInputElement).checked })" /> Panel surya</label>
        </template>
      </div>
      <button class="mt-5 rounded-full bg-gm-primary px-6 py-3 text-sm font-bold text-white disabled:opacity-50" :disabled="props.savingDevice" @click="emit('saveDevice')">{{ props.savingDevice ? 'Menyimpan...' : props.deviceForm.existingDeviceId ? 'Perbarui perangkat' : 'Tambah perangkat' }}</button>
    </article>
    <article class="space-y-4">
      <article v-for="device in props.devices" :key="device._id" class="rounded-[2rem] bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
        <div class="flex items-center justify-between gap-3">
          <div>
            <div class="text-lg font-bold text-gm-text">{{ device.name }}</div>
            <div class="mt-1 text-sm text-gm-muted">{{ device.deviceId }} • {{ device.ownerName || 'Belum diklaim' }}</div>
            <div class="mt-1 text-xs text-gm-muted">{{ device.firmwareVersion || 'FW unknown' }} • {{ device.isOnline ? 'Online' : 'Offline' }}</div>
          </div>
          <div class="flex flex-wrap gap-2">
            <button class="rounded-full bg-[#f3f3f3] px-4 py-2 text-xs font-bold text-gm-text" @click="emit('editDevice', device)">Edit</button>
            <button class="rounded-full bg-[#ffdbcf] px-4 py-2 text-xs font-bold text-[#795548] disabled:opacity-50" :disabled="props.deletingDeviceId === device._id" @click="emit('deleteDevice', device._id)">{{ props.deletingDeviceId === device._id ? 'Menghapus...' : 'Hapus' }}</button>
          </div>
        </div>
      </article>
    </article>
  </section>
</template>
