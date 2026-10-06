<script setup lang="ts">
import type { LifecycleProfile, PlantSensorProfile } from '~~/convex/types'

const sensorProfile = defineModel<PlantSensorProfile>('sensorProfile', { required: true })
const lifecycleProfile = defineModel<LifecycleProfile>('lifecycleProfile', { required: true })

defineProps<{
  totalLifecycleDays: number
}>()
</script>

<template>
  <div class="rounded-[1.5rem] bg-[#f7f7f7] p-5">
    <div>
      <h3 class="font-headline text-lg font-bold text-gm-text">
        Rentang sensor yang cocok
      </h3>
      <p class="mt-1 text-sm text-gm-muted">
            Sistem akan memakai rentang ini untuk menilai apakah kondisi tanaman sedang
        ideal.
      </p>
    </div>

    <div class="mt-4 grid gap-3 md:grid-cols-2">
      <label class="rounded-xl bg-white p-3 text-sm text-gm-muted">
        <span class="mb-2 block font-semibold text-gm-text">Kelembapan tanah (%)</span>
        <div class="grid grid-cols-2 gap-2">
          <input
            v-model="sensorProfile.soil.min"
            type="number"
            min="0"
            max="100"
            class="w-full rounded-xl border border-[#e3e3e3] px-3 py-2 outline-none focus:border-gm-primary"
            placeholder="Min"
          />
          <input
            v-model="sensorProfile.soil.max"
            type="number"
            min="0"
            max="100"
            class="w-full rounded-xl border border-[#e3e3e3] px-3 py-2 outline-none focus:border-gm-primary"
            placeholder="Maks"
          />
        </div>
      </label>
      <label class="rounded-xl bg-white p-3 text-sm text-gm-muted">
        <span class="mb-2 block font-semibold text-gm-text">Cahaya (%)</span>
        <div class="grid grid-cols-2 gap-2">
          <input
            v-model="sensorProfile.light.min"
            type="number"
            min="0"
            max="100"
            class="w-full rounded-xl border border-[#e3e3e3] px-3 py-2 outline-none focus:border-gm-primary"
            placeholder="Min"
          />
          <input
            v-model="sensorProfile.light.max"
            type="number"
            min="0"
            max="100"
            class="w-full rounded-xl border border-[#e3e3e3] px-3 py-2 outline-none focus:border-gm-primary"
            placeholder="Maks"
          />
        </div>
      </label>
      <label class="rounded-xl bg-white p-3 text-sm text-gm-muted">
        <span class="mb-2 block font-semibold text-gm-text">Suhu (C)</span>
        <div class="grid grid-cols-2 gap-2">
          <input
            v-model="sensorProfile.temperature.min"
            type="number"
            class="w-full rounded-xl border border-[#e3e3e3] px-3 py-2 outline-none focus:border-gm-primary"
            placeholder="Min"
          />
          <input
            v-model="sensorProfile.temperature.max"
            type="number"
            class="w-full rounded-xl border border-[#e3e3e3] px-3 py-2 outline-none focus:border-gm-primary"
            placeholder="Maks"
          />
        </div>
      </label>
      <label class="rounded-xl bg-white p-3 text-sm text-gm-muted">
        <span class="mb-2 block font-semibold text-gm-text">Kelembapan udara (%)</span>
        <div class="grid grid-cols-2 gap-2">
          <input
            v-model="sensorProfile.air.min"
            type="number"
            min="0"
            max="100"
            class="w-full rounded-xl border border-[#e3e3e3] px-3 py-2 outline-none focus:border-gm-primary"
            placeholder="Min"
          />
          <input
            v-model="sensorProfile.air.max"
            type="number"
            min="0"
            max="100"
            class="w-full rounded-xl border border-[#e3e3e3] px-3 py-2 outline-none focus:border-gm-primary"
            placeholder="Maks"
          />
        </div>
      </label>
      <label class="rounded-xl bg-white p-3 text-sm text-gm-muted md:col-span-2">
        <span class="mb-2 block font-semibold text-gm-text">Level air reservoir (%)</span>
        <div class="grid grid-cols-2 gap-2">
          <input
            v-model="sensorProfile.water.min"
            type="number"
            min="0"
            max="100"
            class="w-full rounded-xl border border-[#e3e3e3] px-3 py-2 outline-none focus:border-gm-primary"
            placeholder="Min"
          />
          <input
            v-model="sensorProfile.water.max"
            type="number"
            min="0"
            max="100"
            class="w-full rounded-xl border border-[#e3e3e3] px-3 py-2 outline-none focus:border-gm-primary"
            placeholder="Maks"
          />
        </div>
      </label>
    </div>
  </div>

  <div class="rounded-[1.5rem] bg-[#f7f7f7] p-5">
    <div class="flex items-center justify-between gap-4">
      <div>
        <h3 class="font-headline text-lg font-bold text-gm-text">Durasi siklus hidup</h3>
        <p class="mt-1 text-sm text-gm-muted">
          Estimasi total siklus: {{ totalLifecycleDays }} hari
        </p>
      </div>
    </div>

    <div class="mt-4 grid gap-3 md:grid-cols-2">
      <label class="rounded-xl bg-white p-3 text-sm text-gm-muted">
        <span class="mb-2 block font-semibold text-gm-text">Dormansi benih</span>
        <input
          v-model="lifecycleProfile.seedDormancyDays"
          type="number"
          min="0"
          class="w-full rounded-xl border border-[#e3e3e3] px-3 py-2 outline-none focus:border-gm-primary"
        />
      </label>
      <label class="rounded-xl bg-white p-3 text-sm text-gm-muted">
        <span class="mb-2 block font-semibold text-gm-text">Perkecambahan</span>
        <input
          v-model="lifecycleProfile.germinationDays"
          type="number"
          min="0"
          class="w-full rounded-xl border border-[#e3e3e3] px-3 py-2 outline-none focus:border-gm-primary"
        />
      </label>
      <label class="rounded-xl bg-white p-3 text-sm text-gm-muted">
        <span class="mb-2 block font-semibold text-gm-text">Perkembangan bibit</span>
        <input
          v-model="lifecycleProfile.seedlingDevelopmentDays"
          type="number"
          min="0"
          class="w-full rounded-xl border border-[#e3e3e3] px-3 py-2 outline-none focus:border-gm-primary"
        />
      </label>
      <label class="rounded-xl bg-white p-3 text-sm text-gm-muted">
        <span class="mb-2 block font-semibold text-gm-text">Pertumbuhan vegetatif</span>
        <input
          v-model="lifecycleProfile.vegetativeGrowthDays"
          type="number"
          min="0"
          class="w-full rounded-xl border border-[#e3e3e3] px-3 py-2 outline-none focus:border-gm-primary"
        />
      </label>
      <label class="rounded-xl bg-white p-3 text-sm text-gm-muted">
        <span class="mb-2 block font-semibold text-gm-text">Pembungaan / reproduksi</span>
        <input
          v-model="lifecycleProfile.floweringReproductionDays"
          type="number"
          min="0"
          class="w-full rounded-xl border border-[#e3e3e3] px-3 py-2 outline-none focus:border-gm-primary"
        />
      </label>
      <label class="rounded-xl bg-white p-3 text-sm text-gm-muted">
        <span class="mb-2 block font-semibold text-gm-text">Kematangan / senesens</span>
        <input
          v-model="lifecycleProfile.maturitySenescenceDays"
          type="number"
          min="0"
          class="w-full rounded-xl border border-[#e3e3e3] px-3 py-2 outline-none focus:border-gm-primary"
        />
      </label>
    </div>
  </div>
</template>
