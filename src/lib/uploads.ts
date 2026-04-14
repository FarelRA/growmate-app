export async function uploadImageFile(file: File, getUploadUrl: () => Promise<string>) {
  const uploadUrl = await getUploadUrl()
  const response = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
    },
    body: file,
  })

  if (!response.ok) {
    throw new Error('Image upload failed')
  }

  const { storageId } = await response.json() as { storageId?: string }
  if (!storageId) {
    throw new Error('Upload did not return a storage id')
  }

  return storageId
}

export function readSelectedImage(file?: File | null) {
  if (!file) return null

  return URL.createObjectURL(file)
}
