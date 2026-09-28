import { computed, ref, watch } from 'vue'
import type { Ref } from 'vue'
import { useConvexMutation } from '@convex-vue/core'
import { toast } from 'vue-sonner'
import { api } from '@/lib/api'
import { getErrorMessage } from '@/lib/errors'
import type { AdminSupportTicket, Id } from '@/lib/convex-types'

export function useAdminSupport(supportRequests: Ref<AdminSupportTicket[]>) {
  const { mutate: updateSupportRequest } = useConvexMutation(api.support.adminUpdateSupportRequest)
  const { mutate: sendSupportMessage } = useConvexMutation(api.support.sendSupportMessage)

  const selectedSupportRequestId = ref<string | null>(null)
  const supportReplyInput = ref('')
  const updatingTicketId = ref<string | null>(null)
  const sendingTicketMessage = ref(false)

  const supportQueue = computed(() => supportRequests.value)
  const selectedSupportRequest = computed(() =>
    supportQueue.value.find((r) => r._id === selectedSupportRequestId.value) ?? supportQueue.value[0] ?? null,
  )

  watch(supportQueue, (requests) => {
    if (!requests.length) {
      selectedSupportRequestId.value = null
      return
    }
    if (!selectedSupportRequestId.value || !requests.some((r) => r._id === selectedSupportRequestId.value)) {
      selectedSupportRequestId.value = requests[0]?._id ?? null
    }
  }, { immediate: true })

  async function handleTicketUpdate(requestId: string, status: 'open' | 'in_progress' | 'resolved' | 'closed', priority: 'low' | 'normal' | 'high' | 'urgent') {
    updatingTicketId.value = requestId
    try {
      await updateSupportRequest({ requestId: requestId as Id<'supportRequests'>, status, priority })
      toast.success('Tiket dukungan diperbarui')
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Gagal memperbarui tiket'))
    } finally {
      updatingTicketId.value = null
    }
  }

  async function handleSendTicketMessage() {
    if (!selectedSupportRequest.value || !supportReplyInput.value.trim()) return
    sendingTicketMessage.value = true
    try {
      await sendSupportMessage({ requestId: selectedSupportRequest.value._id as Id<'supportRequests'>, body: supportReplyInput.value })
      supportReplyInput.value = ''
      toast.success('Balasan dikirim ke pengguna')
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Gagal mengirim balasan'))
    } finally {
      sendingTicketMessage.value = false
    }
  }

  return {
    supportQueue,
    selectedSupportRequestId,
    selectedSupportRequest,
    supportReplyInput,
    updatingTicketId,
    sendingTicketMessage,
    handleTicketUpdate,
    handleSendTicketMessage,
  }
}
