<script setup lang="ts">
const props = defineProps<{
  device: { autoWatering: boolean; autoLighting: boolean; lightEnabled: boolean; deviceId: string } | null
  schedules: { _id: string; title: string; cadenceLabel: string; nextRunLabel: string; enabled: boolean }[]
  scheduleForm: { scheduleId: string | null; title: string; cadenceValue: number; cadenceUnit: string; timeOfDay: string }
  schedulePreview: string
  savingSchedule: boolean
  deletingScheduleId: string | null
}>()

const emit = defineEmits<{
  water: []
  light: [enabled: boolean]
  toggleAutomation: [type: 'watering' | 'lighting', enabled: boolean]
  toggleSchedule: [scheduleId: string, enabled: boolean]
  saveSchedule: []
  deleteSchedule: [scheduleId: string]
  resetSchedule: []
  editSchedule: [schedule: { _id: string; title: string; cadenceValue: number; cadenceUnit: string; timeOfDayMinutes: number | null }]
  'update:scheduleForm': [value: { scheduleId: string | null; title: string; cadenceValue: number; cadenceUnit: string; timeOfDay: string }]
}>()

function updateForm(field: string, value: string | number) {
  emit('update:scheduleForm', { ...props.scheduleForm, [field]: value })
}
</script>

<template>
  <section class="space-y-4">
    <article class="rounded-[2rem] bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
      <p class="text-xs font-bold uppercase tracking-[0.2em] text-gm-primary">Otomasi</p>
      <h1 class="mt-2 font-headline text-3xl font-black tracking-tight text-gm-text">Pengaturan perawatan</h1>
      <p class="mt-3 text-sm leading-relaxed text-gm-muted">Aktifkan atau matikan otomasi, jalankan aksi manual, dan kelola perawatan berulang dari satu tempat.</p>
    </article>

    <section class="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
      <article class="rounded-[2rem] bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
        <div class="space-y-3">
          <div class="flex items-center justify-between rounded-[1.5rem] bg-[#f3f3f3] p-4">
            <div>
              <div class="text-sm font-bold text-gm-text">Penyiraman otomatis</div>
              <div class="mt-1 text-xs text-gm-muted">Sistem membantu menjalankan penyiraman rutin sesuai pengaturan yang dipilih</div>
            </div>
            <button
              type="button"
              role="switch"
              :aria-checked="device?.autoWatering ?? false"
              aria-label="Penyiraman otomatis"
              class="relative flex h-7 w-12 items-center rounded-full px-1 transition-colors"
              :class="device?.autoWatering ? 'bg-gm-primary' : 'bg-[#d7d7d7]'"
              @click="$emit('toggleAutomation', 'watering', device?.autoWatering ?? false)"
            >
              <span class="h-5 w-5 rounded-full bg-white transition-transform" :class="device?.autoWatering ? 'translate-x-5' : ''"></span>
            </button>
          </div>

          <div class="flex items-center justify-between rounded-[1.5rem] bg-[#f3f3f3] p-4">
            <div>
              <div class="text-sm font-bold text-gm-text">Pencahayaan otomatis</div>
              <div class="mt-1 text-xs text-gm-muted">Sistem membantu menjaga pencahayaan tetap sesuai kebutuhan tanaman</div>
            </div>
            <button
              type="button"
              role="switch"
              :aria-checked="device?.autoLighting ?? false"
              aria-label="Pencahayaan otomatis"
              class="relative flex h-7 w-12 items-center rounded-full px-1 transition-colors"
              :class="device?.autoLighting ? 'bg-gm-primary' : 'bg-[#d7d7d7]'"
              @click="$emit('toggleAutomation', 'lighting', device?.autoLighting ?? false)"
            >
              <span class="h-5 w-5 rounded-full bg-white transition-transform" :class="device?.autoLighting ? 'translate-x-5' : ''"></span>
            </button>
          </div>
        </div>

        <div class="mt-4 grid grid-cols-2 gap-3">
          <button type="button" class="rounded-full bg-gradient-to-r from-gm-primary to-gm-primary-soft px-4 py-3 text-sm font-bold text-white" @click="$emit('water')">
            Siram sekarang
          </button>
          <button type="button" class="rounded-full bg-[#fff6da] px-4 py-3 text-sm font-bold text-[#7a5a00]" @click="$emit('light', !(device?.lightEnabled ?? false))">
            {{ device?.lightEnabled ? 'Matikan lampu' : 'Nyalakan lampu' }}
          </button>
        </div>
      </article>

      <article class="rounded-[2rem] bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="text-xs font-bold uppercase tracking-[0.2em] text-gm-primary">Jadwal</p>
            <h2 class="mt-2 font-headline text-2xl font-black tracking-tight text-gm-text">Rutinitas perawatan</h2>
          </div>
        </div>

        <div class="mt-5 grid gap-3 md:grid-cols-2">
          <label class="md:col-span-2">
            <span class="mb-2 block text-sm font-semibold text-gm-text">Judul jadwal</span>
            <input :value="scheduleForm.title" @input="updateForm('title', ($event.target as HTMLInputElement).value)" class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" placeholder="Penyiraman pagi" />
          </label>
          <label>
            <span class="mb-2 block text-sm font-semibold text-gm-text">Ulangi setiap</span>
            <input :value="scheduleForm.cadenceValue" @input="updateForm('cadenceValue', Number(($event.target as HTMLInputElement).value) || 1)" type="number" min="1" class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" placeholder="1" />
          </label>
          <label>
            <span class="mb-2 block text-sm font-semibold text-gm-text">Satuan</span>
            <select :value="scheduleForm.cadenceUnit" @input="updateForm('cadenceUnit', ($event.target as HTMLSelectElement).value)" class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none">
              <option value="hours">Jam</option>
              <option value="days">Hari</option>
            </select>
          </label>
          <label v-if="scheduleForm.cadenceUnit === 'days'" class="md:col-span-2">
            <span class="mb-2 block text-sm font-semibold text-gm-text">Waktu dalam sehari</span>
            <input :value="scheduleForm.timeOfDay" @input="updateForm('timeOfDay', ($event.target as HTMLInputElement).value)" type="time" class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" />
          </label>
        </div>

        <div class="mt-4 rounded-[1.5rem] bg-[#f3f3f3] px-4 py-3 text-sm text-gm-muted">{{ schedulePreview }}</div>

        <div class="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            class="rounded-full bg-gm-primary px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
            :disabled="savingSchedule"
            @click="$emit('saveSchedule')"
          >
            {{ savingSchedule ? 'Menyimpan...' : scheduleForm.scheduleId ? 'Perbarui rutinitas' : 'Buat rutinitas' }}
          </button>
          <button
            v-if="scheduleForm.scheduleId"
            type="button"
            class="rounded-full bg-[#f3f3f3] px-4 py-3 text-sm font-bold text-gm-text"
            @click="$emit('resetSchedule')"
          >
            Batal edit
          </button>
        </div>

        <div v-if="schedules?.length" class="mt-5 space-y-3">
          <article
            v-for="schedule in schedules"
            :key="schedule._id"
            class="rounded-[1.5rem] bg-[#f3f3f3] p-4"
          >
            <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div class="text-sm font-bold text-gm-text">{{ schedule.title }}</div>
                <div class="mt-1 text-sm text-gm-muted">{{ schedule.cadenceLabel }}</div>
                <div class="mt-1 text-xs text-gm-muted">Berikutnya {{ schedule.nextRunLabel }}</div>
              </div>
              <div class="flex gap-2">
                <button type="button" class="rounded-full bg-white px-4 py-2 text-xs font-bold text-gm-text" @click="$emit('editSchedule', schedule)">Edit</button>
                <button type="button" class="rounded-full bg-white px-4 py-2 text-xs font-bold text-gm-text" @click="$emit('toggleSchedule', schedule._id, schedule.enabled)">
                  {{ schedule.enabled ? 'Jeda' : 'Lanjutkan' }}
                </button>
                <button
                  type="button"
                  class="rounded-full bg-[#ffdbcf] px-4 py-2 text-xs font-bold text-[#795548] disabled:opacity-50"
                  :disabled="deletingScheduleId === schedule._id"
                  @click="$emit('deleteSchedule', schedule._id)"
                >
                  {{ deletingScheduleId === schedule._id ? 'Menghapus...' : 'Hapus' }}
                </button>
              </div>
            </div>
          </article>
        </div>

        <div v-else class="mt-5 rounded-[1.5rem] bg-[#f3f3f3] p-5 text-sm text-gm-muted">Belum ada rutinitas perawatan. Buat satu di atas.</div>
      </article>
    </section>
  </section>
</template>
