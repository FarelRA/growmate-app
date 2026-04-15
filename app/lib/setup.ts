export type SetupStatus = {
  authenticated?: boolean
  setupComplete?: boolean
  nextStep?: 'complete-profile' | 'claim-device' | 'select-plant' | 'done'
  nextDeviceId?: string | null
  isAdmin?: boolean
}

export type SetupRoute = string | { path: string; query?: Record<string, string | undefined> }

export function getSetupRoute(status: SetupStatus | null | undefined): SetupRoute {
  if (!status?.authenticated) {
    return '/login'
  }

  if (status.isAdmin) {
    return '/admin'
  }

  switch (status.nextStep) {
    case 'complete-profile':
      return '/complete-profile'
    case 'claim-device':
      return '/claim-device'
    case 'select-plant':
      return {
        path: '/select-plant',
        query: {
          deviceId: status.nextDeviceId ?? undefined,
          onboarding: '1',
        },
      }
    default:
      return '/dashboard'
  }
}
