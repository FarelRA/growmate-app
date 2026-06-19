import { getAuthToken } from '@/lib/auth'

export async function uploadImageFile(file: File) {
  const token = await getAuthToken()
  const formData = new FormData()
  formData.append('file', file)
  const res = await fetch('/api/v1/upload', {
    method: 'POST',
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
    },
    body: formData,
  })
  if (!res.ok) throw new Error('Upload failed')
  const { path } = await res.json()
  return path as string
}

export function readSelectedImage(file?: File | null) {
  if (!file) return null
  return URL.createObjectURL(file)
}
