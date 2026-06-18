import { onBeforeUnmount, ref } from 'vue'
import { readSelectedImage } from '@/lib/uploads'

export function useImageUpload() {
  const file = ref<File | null>(null)
  const preview = ref<string | null>(null)
  const blobUrl = ref<string | null>(null)

  onBeforeUnmount(() => {
    if (blobUrl.value) URL.revokeObjectURL(blobUrl.value)
  })

  function handleImageChange(event: Event) {
    const input = event.target as HTMLInputElement
    const newFile = input.files?.[0] ?? null
    file.value = newFile
    if (blobUrl.value) URL.revokeObjectURL(blobUrl.value)
    blobUrl.value = readSelectedImage(newFile)
    preview.value = blobUrl.value ?? preview.value
  }

  function setPreview(url: string | null) {
    preview.value = url
  }

  function clearImage() {
    file.value = null
    preview.value = null
    if (blobUrl.value) URL.revokeObjectURL(blobUrl.value)
    blobUrl.value = null
  }

  return { file, preview, blobUrl, handleImageChange, setPreview, clearImage }
}
