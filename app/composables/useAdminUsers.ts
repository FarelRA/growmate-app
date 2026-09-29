import { ref } from 'vue'
import { useConvexMutation } from '@convex-vue/core'
import { toast } from 'vue-sonner'
import { api } from '~~/convex/_generated/api'
import { getErrorMessage } from '~~/shared/utils/errors'
import type { Id } from '@/utils/convex-types'

export function useAdminUsers() {
  const { mutate: updateUserAccess } = useConvexMutation(api.admin.adminUpdateUserAccess)

  const updatingUserId = ref<string | null>(null)

  async function handleUserAccessChange(userId: string, field: 'tier' | 'role', value: string) {
    updatingUserId.value = userId
    try {
      await updateUserAccess({
        userId: userId as Id<'users'>,
        tier: field === 'tier' ? (value as 'basic' | 'advanced') : undefined,
        role: field === 'role' ? (value as 'grower' | 'company' | 'admin') : undefined,
      })
      toast.success('Akun diperbarui')
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Gagal memperbarui akun'))
    } finally {
      updatingUserId.value = null
    }
  }

  return {
    updatingUserId,
    handleUserAccessChange,
  }
}
