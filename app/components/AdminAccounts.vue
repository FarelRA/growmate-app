<script setup lang="ts">
const props = defineProps<{
  userList: { _id: string; name: string; email: string; handle: string | null; tier: string; role: string }[]
  updatingUserId: string | null
}>()
const emit = defineEmits<{
  updateUserAccess: [userId: string, field: 'tier' | 'role', value: string]
}>()
</script>

<template>
  <section class="space-y-4">
    <article v-for="user in props.userList" :key="user._id" class="rounded-[2rem] bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
      <div class="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div><div class="text-lg font-bold text-gm-text">{{ user.name }}</div><div class="mt-1 text-sm text-gm-muted">{{ user.email }} • @{{ user.handle || 'no-handle' }}</div></div>
        <div class="grid gap-3 sm:grid-cols-2">
          <label class="space-y-2"><span class="block text-sm font-semibold text-gm-text">Tier akun</span><select class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" :value="user.tier" :disabled="props.updatingUserId === user._id" @change="emit('updateUserAccess', user._id, 'tier', ($event.target as HTMLSelectElement).value)"><option value="basic">Dasar</option><option value="advanced">Lanjutan</option></select></label>
          <label class="space-y-2"><span class="block text-sm font-semibold text-gm-text">Peran akun</span><select class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" :value="user.role" :disabled="props.updatingUserId === user._id" @change="emit('updateUserAccess', user._id, 'role', ($event.target as HTMLSelectElement).value)"><option value="grower">Grower</option><option value="company">Company</option><option value="admin">Admin</option></select></label>
        </div>
      </div>
    </article>
  </section>
</template>
