import { computed } from 'vue'
import type { Ref } from 'vue'

export type DashboardPanel = 'overview' | 'care' | 'devices' | 'history' | 'stream'

export const panelOptions: Array<{ key: DashboardPanel; label: string; icon: string }> = [
  { key: 'overview', label: 'Ringkasan', icon: 'dashboard' },
  { key: 'care', label: 'Perawatan', icon: 'spa' },
  { key: 'devices', label: 'Perangkat', icon: 'hub' },
  { key: 'history', label: 'Riwayat', icon: 'timeline' },
]

export const iconMap: Record<string, string> = {
  soil: 'opacity',
  light: 'light_mode',
  temperature: 'thermostat',
  air: 'air',
  water: 'water',
}

export const accentMap: Record<string, string> = {
  earth: 'bg-gm-secondary-soft/40 text-[#795548]',
  sun: 'bg-[#94f990]/35 text-gm-primary',
  warm: 'bg-[#ffdbcf] text-[#795548]',
  air: 'bg-[#cae6ff]/50 text-[#006493]',
  water: 'bg-[#00a4ed]/15 text-[#006493]',
}

export function isPanel(value: string | null): value is DashboardPanel {
  return value === 'overview' || value === 'care' || value === 'devices' || value === 'history' || value === 'stream'
}

/**
 * Panel routing for the dashboard: active panel derived from the route
 * query, panel switching, and the select-plant navigation helper.
 * Device data subscriptions stay in `useDashboard`.
 */
export function useDevicePanels(currentDeviceId: Ref<string | undefined>) {
  const route = useRoute()
  const router = useRouter()

  const activePanel = computed<DashboardPanel>(() => {
    const panel = typeof route.query.panel === 'string' ? route.query.panel : null
    return isPanel(panel) ? panel : 'overview'
  })

  function setPanel(panel: DashboardPanel) {
    void router.replace({
      path: '/dashboard',
      query: {
        ...route.query,
        panel: panel === 'overview' ? undefined : panel,
      },
    })
  }

  function openSelectPlant(deviceId?: string) {
    void router.push({
      path: '/select-plant',
      query: {
        deviceId: deviceId ?? currentDeviceId.value,
        returnTo: '/dashboard',
        panel: activePanel.value,
      },
    })
  }

  return {
    panelOptions,
    iconMap,
    accentMap,
    activePanel,
    setPanel,
    openSelectPlant,
  }
}
