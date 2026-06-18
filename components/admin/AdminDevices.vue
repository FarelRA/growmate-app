<script setup lang="ts">
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
  }
  savingDevice: boolean
  deletingDeviceId: string | null
  devices: { _id: string; name: string; deviceId: string; ownerName: string | null; firmwareVersion?: string; isOnline?: boolean }[]
  plantPresets: unknown[]
}>()
const emit = defineEmits<{
  saveDevice: []
  deleteDevice: [id: string]
  editDevice: [device: object]
  resetDeviceForm: []
  'update:deviceForm': [form: object]
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
        <div class="grid gap-3 sm:grid-cols-2">
          <label class="space-y-2"><span class="block text-sm font-semibold text-gm-text">Ambang penyiraman</span><input :value="props.deviceForm.wateringThreshold" type="number" class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" @input="emit('update:deviceForm', { ...props.deviceForm, wateringThreshold: Number(($event.target as HTMLInputElement).value) })" /></label>
          <label class="space-y-2"><span class="block text-sm font-semibold text-gm-text">Durasi penyiraman (dtk)</span><input :value="props.deviceForm.wateringDuration" type="number" class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" @input="emit('update:deviceForm', { ...props.deviceForm, wateringDuration: Number(($event.target as HTMLInputElement).value) })" /></label>
          <label class="space-y-2"><span class="block text-sm font-semibold text-gm-text">Cooldown (dtk)</span><input :value="props.deviceForm.wateringCooldown" type="number" class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" @input="emit('update:deviceForm', { ...props.deviceForm, wateringCooldown: Number(($event.target as HTMLInputElement).value) })" /></label>
          <label class="space-y-2"><span class="block text-sm font-semibold text-gm-text">Ambang cahaya</span><input :value="props.deviceForm.lightingThreshold" type="number" class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" @input="emit('update:deviceForm', { ...props.deviceForm, lightingThreshold: Number(($event.target as HTMLInputElement).value) })" /></label>
          <label class="space-y-2"><span class="block text-sm font-semibold text-gm-text">Histeresis cahaya</span><input :value="props.deviceForm.lightingHysteresis" type="number" class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" @input="emit('update:deviceForm', { ...props.deviceForm, lightingHysteresis: Number(($event.target as HTMLInputElement).value) })" /></label>
        </div>
        <label class="mt-2 flex items-center gap-2 rounded-full bg-[#f3f3f3] px-4 py-3 text-sm font-semibold text-gm-text"><input :checked="props.deviceForm.autoWatering" type="checkbox" @change="emit('update:deviceForm', { ...props.deviceForm, autoWatering: ($event.target as HTMLInputElement).checked })" /> Penyiraman otomatis</label>
        <label class="flex items-center gap-2 rounded-full bg-[#f3f3f3] px-4 py-3 text-sm font-semibold text-gm-text"><input :checked="props.deviceForm.autoLighting" type="checkbox" @change="emit('update:deviceForm', { ...props.deviceForm, autoLighting: ($event.target as HTMLInputElement).checked })" /> Pencahayaan otomatis</label>
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
