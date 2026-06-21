<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { PlantLifecycleStage } from '@/lib/plants'
const props = defineProps<{
  plantPresetForm: {
    presetId: string | null
    key: string
    name: string
    species: string
    growthStage: PlantLifecycleStage
    description: string
    location: string
    category: 'herb' | 'leafy' | 'fruiting' | 'houseplant' | 'flower' | 'microgreen'
    difficulty: 'easy' | 'medium' | 'advanced'
    wateringThreshold: number
    lightingThreshold: number
    sensorProfile: {
      soil: { min: number; max: number }
      light: { min: number; max: number }
      temperature: { min: number; max: number }
      air: { min: number; max: number }
      water: { min: number; max: number }
    }
    lifecycleProfile: {
      seedDormancyDays: number
      germinationDays: number
      seedlingDevelopmentDays: number
      vegetativeGrowthDays: number
      floweringReproductionDays: number
      maturitySenescenceDays: number
    }
  }
  plantPresetImagePreview: string | null
  savingPlantPreset: boolean
  deletingPlantPresetId: string | null
  plantPresetList: any[]
}>()
const emit = defineEmits<{
  savePlantPreset: []
  deletePlantPreset: [id: string]
  editPlantPreset: [preset: any]
  resetPlantPresetForm: []
  handlePlantPresetImageChange: [event: Event]
  'update:plantPresetForm': [form: { presetId: string | null; key: string; name: string; species: string; growthStage: PlantLifecycleStage; description: string; location: string; category: 'herb' | 'leafy' | 'fruiting' | 'houseplant' | 'flower' | 'microgreen'; difficulty: 'easy' | 'medium' | 'advanced'; wateringThreshold: number; lightingThreshold: number; sensorProfile: { soil: { min: number; max: number }; light: { min: number; max: number }; temperature: { min: number; max: number }; air: { min: number; max: number }; water: { min: number; max: number } }; lifecycleProfile: { seedDormancyDays: number; germinationDays: number; seedlingDevelopmentDays: number; vegetativeGrowthDays: number; floweringReproductionDays: number; maturitySenescenceDays: number } }]
}>()

const sensorKinds = ['soil', 'light', 'temperature', 'air', 'water'] as const
</script>

<template>
  <section class="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
    <article class="rounded-[2rem] bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
      <div class="flex items-center justify-between gap-3">
        <h2 class="font-headline text-2xl font-bold text-gm-text">{{ props.plantPresetForm.presetId ? 'Edit preset' : 'Tambah preset' }}</h2>
        <button v-if="props.plantPresetForm.presetId" class="rounded-full bg-[#f3f3f3] px-4 py-2 text-xs font-bold text-gm-text" @click="emit('resetPlantPresetForm')">Batal</button>
      </div>
      <div class="mt-5 grid gap-3">
        <label class="space-y-2"><span class="block text-sm font-semibold text-gm-text">Kunci preset</span><input :value="props.plantPresetForm.key" class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" placeholder="tomato-romani" @input="emit('update:plantPresetForm', { ...props.plantPresetForm, key: ($event.target as HTMLInputElement).value })" /></label>
        <label class="space-y-2"><span class="block text-sm font-semibold text-gm-text">Nama tanaman</span><input :value="props.plantPresetForm.name" class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" placeholder="Tomat Romani" @input="emit('update:plantPresetForm', { ...props.plantPresetForm, name: ($event.target as HTMLInputElement).value })" /></label>
        <div class="grid gap-3 sm:grid-cols-2">
          <label class="space-y-2"><span class="block text-sm font-semibold text-gm-text">Spesies</span><input :value="props.plantPresetForm.species" class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" placeholder="Solanum lycopersicum" @input="emit('update:plantPresetForm', { ...props.plantPresetForm, species: ($event.target as HTMLInputElement).value })" /></label>
          <label class="space-y-2"><span class="block text-sm font-semibold text-gm-text">Lokasi tanam</span><input :value="props.plantPresetForm.location" class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" placeholder="Indoor" @input="emit('update:plantPresetForm', { ...props.plantPresetForm, location: ($event.target as HTMLInputElement).value })" /></label>
          <label class="space-y-2"><span class="block text-sm font-semibold text-gm-text">Tahap tumbuh</span><select :value="props.plantPresetForm.growthStage" class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" @change="emit('update:plantPresetForm', { ...props.plantPresetForm, growthStage: ($event.target as HTMLSelectElement).value })"><option value="seed_dormancy">Seed Dormancy</option><option value="germination">Germination</option><option value="seedling_development">Seedling Development</option><option value="vegetative_growth">Vegetative Growth</option><option value="flowering_reproduction">Flowering Reproduction</option><option value="maturity_senescence">Maturity Senescence</option></select></label>
          <label class="space-y-2"><span class="block text-sm font-semibold text-gm-text">Kategori</span><select :value="props.plantPresetForm.category" class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" @change="emit('update:plantPresetForm', { ...props.plantPresetForm, category: ($event.target as HTMLSelectElement).value })"><option value="herb">Herb</option><option value="leafy">Leafy</option><option value="fruiting">Fruiting</option><option value="houseplant">Houseplant</option><option value="flower">Flower</option><option value="microgreen">Microgreen</option></select></label>
          <label class="space-y-2"><span class="block text-sm font-semibold text-gm-text">Kesulitan</span><select :value="props.plantPresetForm.difficulty" class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" @change="emit('update:plantPresetForm', { ...props.plantPresetForm, difficulty: ($event.target as HTMLSelectElement).value })"><option value="easy">Easy</option><option value="medium">Medium</option><option value="advanced">Advanced</option></select></label>
        </div>
        <label class="space-y-2"><span class="block text-sm font-semibold text-gm-text">Deskripsi</span><textarea :value="props.plantPresetForm.description" rows="3" class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" @input="emit('update:plantPresetForm', { ...props.plantPresetForm, description: ($event.target as HTMLInputElement).value })" /></label>
        <div class="grid gap-3 sm:grid-cols-2">
          <label class="space-y-2"><span class="block text-sm font-semibold text-gm-text">Ambang penyiraman</span><input :value="props.plantPresetForm.wateringThreshold" type="number" class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" @input="emit('update:plantPresetForm', { ...props.plantPresetForm, wateringThreshold: Number(($event.target as HTMLInputElement).value) })" /></label>
          <label class="space-y-2"><span class="block text-sm font-semibold text-gm-text">Ambang cahaya</span><input :value="props.plantPresetForm.lightingThreshold" type="number" class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" @input="emit('update:plantPresetForm', { ...props.plantPresetForm, lightingThreshold: Number(($event.target as HTMLInputElement).value) })" /></label>
        </div>
        <details class="rounded-[1.5rem] bg-[#f3f3f3] p-4">
          <summary class="cursor-pointer text-sm font-bold text-gm-text">Profil sensor</summary>
          <div class="mt-4 grid gap-3">
            <div v-for="kind in sensorKinds" :key="kind" class="grid grid-cols-2 gap-2">
              <div class="text-xs font-semibold text-gm-muted uppercase">{{ kind }}</div>
              <div class="grid grid-cols-2 gap-2">
                <input :value="(props.plantPresetForm.sensorProfile as any)[kind].min" type="number" class="rounded-2xl bg-white px-3 py-2 text-xs outline-none" placeholder="Min" @input="emit('update:plantPresetForm', { ...props.plantPresetForm, sensorProfile: { ...props.plantPresetForm.sensorProfile, [kind]: { ...(props.plantPresetForm.sensorProfile as any)[kind], min: Number(($event.target as HTMLInputElement).value) } } })" />
                <input :value="(props.plantPresetForm.sensorProfile as any)[kind].max" type="number" class="rounded-2xl bg-white px-3 py-2 text-xs outline-none" placeholder="Max" @input="emit('update:plantPresetForm', { ...props.plantPresetForm, sensorProfile: { ...props.plantPresetForm.sensorProfile, [kind]: { ...(props.plantPresetForm.sensorProfile as any)[kind], max: Number(($event.target as HTMLInputElement).value) } } })" />
              </div>
            </div>
          </div>
        </details>
        <details class="rounded-[1.5rem] bg-[#f3f3f3] p-4">
          <summary class="cursor-pointer text-sm font-bold text-gm-text">Siklus hidup</summary>
          <div class="mt-4 grid gap-3 sm:grid-cols-2">
            <label class="space-y-1"><span class="text-xs text-gm-muted">Seed Dormancy (hari)</span><input :value="props.plantPresetForm.lifecycleProfile.seedDormancyDays" type="number" class="w-full rounded-2xl bg-white px-3 py-2 text-xs outline-none" @input="emit('update:plantPresetForm', { ...props.plantPresetForm, lifecycleProfile: { ...props.plantPresetForm.lifecycleProfile, seedDormancyDays: Number(($event.target as HTMLInputElement).value) } })" /></label>
            <label class="space-y-1"><span class="text-xs text-gm-muted">Germination (hari)</span><input :value="props.plantPresetForm.lifecycleProfile.germinationDays" type="number" class="w-full rounded-2xl bg-white px-3 py-2 text-xs outline-none" @input="emit('update:plantPresetForm', { ...props.plantPresetForm, lifecycleProfile: { ...props.plantPresetForm.lifecycleProfile, germinationDays: Number(($event.target as HTMLInputElement).value) } })" /></label>
            <label class="space-y-1"><span class="text-xs text-gm-muted">Seedling Development (hari)</span><input :value="props.plantPresetForm.lifecycleProfile.seedlingDevelopmentDays" type="number" class="w-full rounded-2xl bg-white px-3 py-2 text-xs outline-none" @input="emit('update:plantPresetForm', { ...props.plantPresetForm, lifecycleProfile: { ...props.plantPresetForm.lifecycleProfile, seedlingDevelopmentDays: Number(($event.target as HTMLInputElement).value) } })" /></label>
            <label class="space-y-1"><span class="text-xs text-gm-muted">Vegetative Growth (hari)</span><input :value="props.plantPresetForm.lifecycleProfile.vegetativeGrowthDays" type="number" class="w-full rounded-2xl bg-white px-3 py-2 text-xs outline-none" @input="emit('update:plantPresetForm', { ...props.plantPresetForm, lifecycleProfile: { ...props.plantPresetForm.lifecycleProfile, vegetativeGrowthDays: Number(($event.target as HTMLInputElement).value) } })" /></label>
            <label class="space-y-1"><span class="text-xs text-gm-muted">Flowering Reproduction (hari)</span><input :value="props.plantPresetForm.lifecycleProfile.floweringReproductionDays" type="number" class="w-full rounded-2xl bg-white px-3 py-2 text-xs outline-none" @input="emit('update:plantPresetForm', { ...props.plantPresetForm, lifecycleProfile: { ...props.plantPresetForm.lifecycleProfile, floweringReproductionDays: Number(($event.target as HTMLInputElement).value) } })" /></label>
            <label class="space-y-1"><span class="text-xs text-gm-muted">Maturity Senescence (hari)</span><input :value="props.plantPresetForm.lifecycleProfile.maturitySenescenceDays" type="number" class="w-full rounded-2xl bg-white px-3 py-2 text-xs outline-none" @input="emit('update:plantPresetForm', { ...props.plantPresetForm, lifecycleProfile: { ...props.plantPresetForm.lifecycleProfile, maturitySenescenceDays: Number(($event.target as HTMLInputElement).value) } })" /></label>
          </div>
        </details>
        <label class="space-y-2"><span class="block text-sm font-semibold text-gm-text">Gambar preset</span><input type="file" accept="image/*" class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" @change="emit('handlePlantPresetImageChange', $event)" /></label>
        <img v-if="props.plantPresetImagePreview" :src="props.plantPresetImagePreview" alt="Preview" class="h-48 w-full rounded-[1.5rem] object-cover" />
      </div>
      <button class="mt-5 rounded-full bg-gm-primary px-6 py-3 text-sm font-bold text-white disabled:opacity-50" :disabled="props.savingPlantPreset" @click="emit('savePlantPreset')">{{ props.savingPlantPreset ? 'Menyimpan...' : props.plantPresetForm.presetId ? 'Perbarui preset' : 'Buat preset' }}</button>
    </article>
    <article class="space-y-4">
      <article v-for="preset in props.plantPresetList" :key="preset._id" class="rounded-[2rem] bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
        <div class="flex gap-4">
          <img :src="preset.imageUrl ?? undefined" :alt="preset.name" class="h-20 w-20 shrink-0 rounded-[1.25rem] object-cover" />
          <div class="min-w-0 flex-1">
            <div class="text-lg font-bold text-gm-text">{{ preset.name }}</div>
            <div class="mt-1 text-sm text-gm-muted">{{ preset.species }} • {{ preset.category }} • {{ preset.difficulty }}</div>
          </div>
        </div>
        <div class="mt-3 flex flex-wrap gap-2">
          <button class="rounded-full bg-[#f3f3f3] px-4 py-2 text-xs font-bold text-gm-text" @click="emit('editPlantPreset', preset)">Edit</button>
          <button class="rounded-full bg-[#ffdbcf] px-4 py-2 text-xs font-bold text-[#795548] disabled:opacity-50" :disabled="props.deletingPlantPresetId === preset._id" @click="emit('deletePlantPreset', preset._id)">{{ props.deletingPlantPresetId === preset._id ? 'Menghapus...' : 'Hapus' }}</button>
        </div>
      </article>
    </article>
  </section>
</template>
