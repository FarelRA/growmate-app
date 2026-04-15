<script setup lang="ts">
definePageMeta({
  public: true,
})

useHead({
  title: 'GrowMate',
  meta: [
    {
      name: 'description',
      content: 'GrowMate is the connected growing platform for smart plant care, hardware monitoring, automation, and crop support.',
    },
  ],
})

const featureCards = [
  {
    title: 'Connected plant monitoring',
    detail: 'Track moisture, light, temperature, humidity, and watering history from one dashboard built for daily decisions.',
  },
  {
    title: 'Automation that stays practical',
    detail: 'Turn care schedules, watering triggers, and lighting controls into repeatable operations for each device.',
  },
  {
    title: 'Grower workflow in one place',
    detail: 'Use the assistant, marketplace, support, and community tools without splitting work across separate apps.',
  },
]

const stats = [
  { value: '24/7', label: 'device telemetry visibility' },
  { value: '1 app', label: 'for monitoring, support, and care actions' },
  { value: 'GrowMate', label: 'hardware plus software ecosystem' },
]

const pillars = [
  'Device-aware care workflows for real growing environments',
  'PWA installability for a mobile-first operations experience',
  'Built-in setup flow from account creation to first planted device',
]
</script>

<template>
  <div class="min-h-screen bg-gm-surface text-gm-text">
    <section class="relative overflow-hidden">
      <div class="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(76,175,80,0.16),transparent_28%),radial-gradient(circle_at_right,rgba(122,86,73,0.12),transparent_24%)]" />
      <div class="relative mx-auto flex max-w-7xl flex-col gap-10 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
        <header class="flex flex-col gap-4 rounded-[2rem] bg-white/88 px-5 py-4 shadow-[0_12px_40px_rgba(15,23,42,0.05)] backdrop-blur-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div class="flex items-center gap-3">
            <span class="material-symbols-outlined text-2xl text-gm-primary">potted_plant</span>
            <div>
              <div class="font-headline text-xl font-black italic tracking-tight text-gm-primary">GrowMate</div>
              <div class="text-xs font-semibold uppercase tracking-[0.18em] text-gm-muted">Smart growing platform</div>
            </div>
          </div>
          <div class="flex flex-wrap items-center gap-3">
            <NuxtLink class="rounded-full px-4 py-2 text-sm font-semibold text-gm-text transition hover:bg-[#f3f3f3]" to="/login">Login</NuxtLink>
            <NuxtLink class="rounded-full bg-gm-primary px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#0b7d29]" to="/register">Get Started</NuxtLink>
          </div>
        </header>

        <div class="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-10">
          <section class="rounded-[2.5rem] bg-white p-7 shadow-[0_20px_80px_rgba(15,23,42,0.08)] sm:p-10 lg:p-12">
            <p class="text-xs font-bold uppercase tracking-[0.28em] text-gm-primary">GrowMate Company</p>
            <h1 class="mt-4 max-w-4xl font-headline text-4xl font-black tracking-tight text-gm-text sm:text-5xl lg:text-6xl">
              Grow with a system that understands your <span class="italic text-gm-primary">plants, devices, and routines</span>.
            </h1>
            <p class="mt-5 max-w-2xl text-base leading-8 text-gm-muted sm:text-lg">
              GrowMate brings connected hardware, actionable telemetry, automation controls, and grower support into one operational workspace for home growers and agricultural teams.
            </p>

            <div class="mt-8 flex flex-wrap gap-3">
              <NuxtLink class="rounded-full bg-gradient-to-r from-gm-primary to-gm-primary-soft px-6 py-3.5 text-sm font-bold text-white shadow-[0_14px_32px_rgba(0,110,28,0.18)]" to="/register">
                Create account
              </NuxtLink>
              <NuxtLink class="rounded-full bg-[#f3f3f3] px-6 py-3.5 text-sm font-bold text-gm-text" to="/login">
                Open existing workspace
              </NuxtLink>
            </div>

            <div class="mt-10 grid gap-4 sm:grid-cols-3">
              <article v-for="stat in stats" :key="stat.label" class="rounded-[1.5rem] bg-[#f7f7f7] p-4">
                <div class="text-2xl font-black text-gm-primary">{{ stat.value }}</div>
                <div class="mt-2 text-sm leading-relaxed text-gm-muted">{{ stat.label }}</div>
              </article>
            </div>
          </section>

          <section class="grid gap-4">
            <article class="rounded-[2rem] bg-[#0f2916] p-7 text-white shadow-[0_20px_70px_rgba(0,0,0,0.18)] sm:p-8">
              <p class="text-xs font-bold uppercase tracking-[0.24em] text-emerald-200">Why teams use GrowMate</p>
              <div class="mt-4 space-y-4">
                <div v-for="pillar in pillars" :key="pillar" class="flex items-start gap-3 rounded-[1.25rem] bg-white/8 p-4">
                  <span class="material-symbols-outlined mt-0.5 text-emerald-200">check_circle</span>
                  <p class="text-sm leading-7 text-white/88">{{ pillar }}</p>
                </div>
              </div>
            </article>

            <article class="rounded-[2rem] bg-white p-7 shadow-[0_18px_60px_rgba(15,23,42,0.06)] sm:p-8">
              <p class="text-xs font-bold uppercase tracking-[0.24em] text-gm-secondary">From setup to harvest</p>
              <h2 class="mt-3 font-headline text-2xl font-black tracking-tight text-gm-text">One connected flow</h2>
              <p class="mt-3 text-sm leading-7 text-gm-muted">
                Account setup, device claiming, plant selection, telemetry review, support tickets, and grower collaboration all stay inside the same product surface.
              </p>
            </article>
          </section>
        </div>
      </div>
    </section>

    <section class="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div class="grid gap-5 lg:grid-cols-3">
        <article v-for="card in featureCards" :key="card.title" class="rounded-[2rem] bg-white p-6 shadow-[0_14px_40px_rgba(15,23,42,0.05)] sm:p-7">
          <p class="text-xs font-bold uppercase tracking-[0.22em] text-gm-primary">Platform capability</p>
          <h2 class="mt-3 font-headline text-2xl font-black tracking-tight text-gm-text">{{ card.title }}</h2>
          <p class="mt-4 text-sm leading-7 text-gm-muted">{{ card.detail }}</p>
        </article>
      </div>
    </section>

    <section class="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8 lg:pb-16">
      <div class="rounded-[2.5rem] bg-gradient-to-r from-gm-primary to-gm-primary-soft px-6 py-8 text-white shadow-[0_20px_80px_rgba(0,110,28,0.22)] sm:px-10 sm:py-10 lg:flex lg:items-center lg:justify-between">
        <div class="max-w-3xl">
          <p class="text-xs font-bold uppercase tracking-[0.26em] text-white/80">Start with GrowMate</p>
          <h2 class="mt-3 font-headline text-3xl font-black tracking-tight sm:text-4xl">Set up your first connected grow workspace.</h2>
          <p class="mt-4 text-sm leading-7 text-white/88 sm:text-base">
            Join the platform, claim your device, choose a plant profile, and manage day-to-day care from the dashboard.
          </p>
        </div>
        <div class="mt-6 flex flex-wrap gap-3 lg:mt-0 lg:justify-end">
          <NuxtLink class="rounded-full bg-white px-6 py-3 text-sm font-bold text-gm-primary" to="/register">Create account</NuxtLink>
          <NuxtLink class="rounded-full border border-white/30 px-6 py-3 text-sm font-bold text-white" to="/login">Sign in</NuxtLink>
        </div>
      </div>
    </section>
  </div>
</template>
