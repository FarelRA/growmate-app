<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import { useConvexMutation, useConvexQuery } from '@convex-vue/core'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '@/lib/api'
import { activeDeviceId, setActiveDeviceId, syncActiveDevice } from '@/lib/devices'
import { getErrorMessage } from '@/lib/errors'

const router = useRouter()

const deviceIdInput = ref('')
const verifiedDeviceId = ref('')
const checkingDevice = ref(false)
const claimingDevice = ref(false)
const removingDeviceId = ref<string | null>(null)

const { data: setupStatus } = useConvexQuery(api.growmate.checkSetupStatus, {})
const { data: devices } = useConvexQuery(api.growmate.userDevices, {})
const { mutate: claimDevice } = useConvexMutation(api.growmate.claimDevice)
const { mutate: removeDevice } = useConvexMutation(api.growmate.removeDevice)
const convexClient = new ConvexHttpClient(import.meta.env.VITE_CONVEX_URL)

const unclaimedDevice = ref<{ deviceId: string; name: string; firmwareVersion?: string } | null>(null)

watch(setupStatus, async (status) => {
  if (!status) return
  if (!status.authenticated) {
    await router.replace('/login')
    return
  }
  if (status.isAdmin || !status.hasProfile) {
    await router.replace(getSetupRoute(status))
  }
}, { immediate: true })

watch(devices, (deviceList) => {
  if (!deviceList) return
  syncActiveDevice(deviceList)
}, { immediate: true })

watch(deviceIdInput, (value) => {
  if (unclaimedDevice.value && value.trim() !== unclaimedDevice.value.deviceId) {
    unclaimedDevice.value = null
    verifiedDeviceId.value = ''
  }
})

function handleSelectDevice(deviceId: string) {
  setActiveDeviceId(deviceId)
  toast.success('Active device updated')
}

async function handleCheckDevice() {
  const trimmed = deviceIdInput.value.trim()
  if (!trimmed) {
    toast.error('Enter a device ID first')
    return
  }

  checkingDevice.value = true
  verifiedDeviceId.value = trimmed

  try {
    const result = await convexClient.query(api.growmate.getUnclaimedDevice, { deviceId: trimmed })
    unclaimedDevice.value = result
    if (result) {
      toast.success(`Found ${result.name}`)
    } else {
      toast.error('Device not found or already claimed')
    }
  } finally {
    checkingDevice.value = false
  }
}

async function handleClaimDevice() {
  if (!unclaimedDevice.value) {
    toast.error('Verify a device before claiming it')
    return
  }

  claimingDevice.value = true
  try {
    await claimDevice({ deviceId: unclaimedDevice.value.deviceId })
    setActiveDeviceId(unclaimedDevice.value.deviceId)
    toast.success('Device claimed. Next, pick a plant.')
    await router.push({
      path: '/select-plant',
      query: { deviceId: unclaimedDevice.value.deviceId, returnTo: '/devices' },
    })
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, 'Failed to claim device'))
  } finally {
    claimingDevice.value = false
  }
}

async function handleRemoveDevice(deviceId: string, name: string) {
  if (!window.confirm(`Remove ${name}? The device will become unclaimed and its current plant will be archived.`)) {
    return
  }

  removingDeviceId.value = deviceId
  try {
    await removeDevice({ deviceId })
    if (activeDeviceId.value === deviceId) {
      setActiveDeviceId(null)
    }
    toast.success('Device removed and returned to unclaimed inventory')
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, 'Failed to remove device'))
  } finally {
    removingDeviceId.value = null
  }
}
</script>

<template>
  <div class="space-y-8">
    <section class="rounded-[2rem] bg-white p-8 shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
      <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p class="text-xs font-bold uppercase tracking-[0.24em] text-gm-primary">Device Fleet</p>
          <h1 class="mt-2 font-headline text-4xl font-black tracking-tight text-gm-text">Manage every GrowMate pod</h1>
          <p class="mt-3 max-w-2xl text-sm leading-relaxed text-gm-muted">
            One user can manage multiple devices. Each device has its own current plant, and switching plants archives the previous one for history.
          </p>
        </div>
        <div class="rounded-2xl bg-[#f3f3f3] px-5 py-4 text-sm text-gm-muted">
          <div class="font-bold text-gm-text">{{ devices?.length ?? 0 }} devices</div>
          <div>{{ setupStatus?.configuredDevicesCount ?? 0 }} with active plants</div>
        </div>
      </div>
    </section>

    <section class="grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
      <div class="space-y-6">
        <article
          v-for="device in devices"
          :key="device.deviceId"
          class="rounded-[2rem] bg-white p-6 shadow-[0_12px_40px_rgba(15,23,42,0.06)]"
        >
          <div class="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div class="space-y-3">
              <div class="flex flex-wrap items-center gap-3">
                <h2 class="font-headline text-2xl font-bold text-gm-text">{{ device.name }}</h2>
                <span class="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em]" :class="device.deviceId === activeDeviceId ? 'bg-gm-primary text-white' : 'bg-[#f3f3f3] text-gm-muted'">
                  {{ device.deviceId === activeDeviceId ? 'Active' : 'Available' }}
                </span>
                <span class="rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em]" :class="device.isOnline ? 'bg-[#94f990]/40 text-[#005313]' : 'bg-[#e8e8e8] text-gm-muted'">
                  {{ device.isOnline ? 'Online' : 'Offline' }}
                </span>
              </div>
              <p class="text-sm text-gm-muted">{{ device.deviceId }}<span v-if="device.firmwareVersion"> • Firmware {{ device.firmwareVersion }}</span></p>
              <div v-if="device.plant" class="rounded-[1.5rem] bg-[#f3f3f3] p-4">
                <div class="text-xs font-bold uppercase tracking-[0.18em] text-gm-muted">Current Plant</div>
                <div class="mt-2 text-lg font-bold text-gm-text">{{ device.plant.name }}</div>
                <div class="text-sm text-gm-muted">{{ device.plant.species }} • {{ device.plant.growthStageLabel }}</div>
                <div class="mt-2 text-xs text-gm-muted">Archived plants: {{ device.archivedPlantCount }}</div>
              </div>
              <div v-else class="rounded-[1.5rem] border border-dashed border-[#d8d8d8] p-4 text-sm text-gm-muted">
                This device is claimed but still needs a plant.
              </div>

              <div v-if="device.archivedPlants?.length" class="rounded-[1.5rem] border border-[#ececec] p-4">
                <div class="text-xs font-bold uppercase tracking-[0.18em] text-gm-muted">Archive Preview</div>
                <div class="mt-3 space-y-3">
                  <div v-for="plant in device.archivedPlants" :key="plant._id" class="rounded-xl bg-[#f7f7f7] p-3">
                    <div class="text-sm font-bold text-gm-text">{{ plant.name }}</div>
                    <div class="text-xs text-gm-muted">{{ plant.species }} • Archived {{ plant.archivedAtLabel }}</div>
                  </div>
                </div>
              </div>

              <div v-if="device.recentEvents?.length" class="rounded-[1.5rem] border border-[#ececec] p-4">
                <div class="text-xs font-bold uppercase tracking-[0.18em] text-gm-muted">Recent History</div>
                <div class="mt-3 space-y-3">
                  <div v-for="event in device.recentEvents" :key="event._id" class="rounded-xl bg-[#f7f7f7] p-3">
                    <div class="flex items-center justify-between gap-3">
                      <div>
                        <div class="text-sm font-bold text-gm-text">{{ event.title }}</div>
                        <div v-if="event.detail" class="text-xs text-gm-muted">{{ event.detail }}</div>
                      </div>
                      <div class="text-[11px] text-gm-muted">{{ event.relativeTime }}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div class="flex flex-wrap gap-3 lg:max-w-xs lg:justify-end">
              <button type="button" class="rounded-full bg-[#f3f3f3] px-5 py-3 text-sm font-semibold text-gm-text" @click="handleSelectDevice(device.deviceId)">
                {{ device.deviceId === activeDeviceId ? 'Selected' : 'Set Active' }}
              </button>
              <button type="button" class="rounded-full bg-gm-primary px-5 py-3 text-sm font-semibold text-white" @click="router.push({ path: '/select-plant', query: { deviceId: device.deviceId, returnTo: '/devices' } })">
                {{ device.plant ? 'Change Plant' : 'Choose Plant' }}
              </button>
              <button type="button" class="rounded-full bg-[#e8e8e8] px-5 py-3 text-sm font-semibold text-gm-text" @click="router.push('/')">
                View Dashboard
              </button>
              <button type="button" class="rounded-full bg-[#e8f4ff] px-5 py-3 text-sm font-semibold text-[#006493]" @click="setActiveDeviceId(device.deviceId); router.push('/history')">
                View History
              </button>
              <button type="button" class="rounded-full bg-[#ffdbcf] px-5 py-3 text-sm font-semibold text-[#795548] disabled:opacity-50" :disabled="removingDeviceId === device.deviceId" @click="handleRemoveDevice(device.deviceId, device.name)">
                {{ removingDeviceId === device.deviceId ? 'Removing...' : 'Remove Device' }}
              </button>
            </div>
          </div>
        </article>

        <div v-if="!devices?.length" class="rounded-[2rem] bg-white p-10 text-center shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
          <span class="material-symbols-outlined text-6xl text-gm-muted">hub</span>
          <h2 class="mt-4 font-headline text-2xl font-bold text-gm-text">No devices yet</h2>
          <p class="mt-2 text-sm text-gm-muted">Claim your first GrowMate pod to start device-based onboarding.</p>
        </div>
      </div>

      <aside class="space-y-6 rounded-[2rem] bg-white p-8 shadow-[0_12px_40px_rgba(15,23,42,0.06)]">
        <div>
          <p class="text-xs font-bold uppercase tracking-[0.24em] text-gm-primary">Add Device</p>
          <h2 class="mt-2 font-headline text-2xl font-bold text-gm-text">Claim another pod</h2>
          <p class="mt-2 text-sm text-gm-muted">Claiming adds the device to your account. You'll choose its plant next.</p>
        </div>

        <div class="rounded-[1.5rem] bg-[#f3f3f3] p-4 text-sm text-gm-muted">
          Device IDs are printed on the pod or packaging. Example: <span class="font-bold text-gm-text">ESP32_DEMO_001</span>
        </div>

        <div class="space-y-4">
          <div>
            <label class="mb-2 block text-sm font-semibold text-gm-text">Device ID</label>
            <div class="flex gap-3">
              <input v-model="deviceIdInput" type="text" class="flex-1 rounded-2xl border border-[#d9d9d9] px-4 py-3 outline-none transition focus:border-gm-primary" placeholder="ESP32_DEMO_001" />
              <button type="button" class="rounded-2xl bg-gm-text px-4 py-3 text-sm font-semibold text-white disabled:opacity-50" :disabled="checkingDevice" @click="handleCheckDevice">
                {{ checkingDevice ? 'Checking...' : 'Verify' }}
              </button>
            </div>
          </div>

          <div v-if="unclaimedDevice" class="rounded-[1.5rem] bg-[#94f990]/20 p-4 text-sm text-[#005313]">
            <div class="font-bold">{{ unclaimedDevice.name }}</div>
            <div>{{ unclaimedDevice.deviceId }}</div>
            <div v-if="unclaimedDevice.firmwareVersion">Firmware {{ unclaimedDevice.firmwareVersion }}</div>
          </div>

          <button type="button" class="w-full rounded-full bg-gradient-to-r from-gm-primary to-gm-primary-soft px-6 py-4 text-sm font-bold text-white shadow-lg shadow-gm-primary/20 disabled:cursor-not-allowed disabled:opacity-50" :disabled="claimingDevice || !unclaimedDevice" @click="handleClaimDevice">
            {{ claimingDevice ? 'Claiming device...' : 'Claim Device and Select Plant' }}
          </button>
        </div>
      </aside>
    </section>
  </div>
</template>
