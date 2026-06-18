<script setup lang="ts">
defineProps<{
  modelValue: string
  sending: boolean
  disabled: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  send: []
}>()
</script>

<template>
  <div class="bg-[#f3f3f3] p-2 rounded-[1.75rem]">
    <div class="flex items-end gap-3">
      <textarea
        :value="modelValue"
        rows="1"
        class="min-h-[56px] flex-1 resize-none rounded-[1.25rem] bg-white px-4 py-3 text-sm outline-none disabled:opacity-50"
        :disabled="sending || disabled"
        placeholder="Tulis pertanyaan Anda tentang kondisi tanaman, perawatan, atau budidaya..."
        @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
        @keyup.enter.exact.prevent="!sending && !disabled && emit('send')"
      />
      <button
        class="rounded-full bg-gm-primary p-4 text-white shadow-md disabled:opacity-50"
        :disabled="sending || disabled"
        @click="emit('send')"
      >
        <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1">{{
          sending ? 'hourglass_top' : 'send'
        }}</span>
      </button>
    </div>
  </div>
</template>
