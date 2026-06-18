import { computed, ref } from 'vue'
import type { Ref } from 'vue'
import { useConvexMutation } from '@convex-vue/core'
import { toast } from 'vue-sonner'
import { api } from '@/lib/api'
import { getErrorMessage } from '@/lib/errors'
import { renderMarkdown } from '@/lib/markdown'
import type { Id } from '@/lib/convex-types'
import { uploadImageFile } from '@/lib/uploads'
import { useImageUpload } from './useImageUpload'
import type { AdminTab } from './useAdminDevices'

export function useAdminBlog(activeTab: Ref<AdminTab>) {
  const { mutate: saveBlogPost } = useConvexMutation(api.blog.adminSaveBlogPost)
  const { mutate: deleteBlogPost } = useConvexMutation(api.blog.adminDeleteBlogPost)
  const { mutate: generateImageUploadUrl } = useConvexMutation(api.images.generateImageUploadUrl)

  const img = useImageUpload()

  const savingBlogPost = ref(false)
  const deletingBlogPostId = ref<string | null>(null)

  const blogPostForm = ref({
    postId: null as string | null,
    title: '',
    excerpt: '',
    body: '',
    published: true,
    featured: false,
  })

  const renderedBlogPreview = computed(() => renderMarkdown(blogPostForm.value.body))

  function resetBlogPostForm() {
    blogPostForm.value = {
      postId: null,
      title: '',
      excerpt: '',
      body: '',
      published: true,
      featured: false,
    }
    img.clearImage()
  }

  function editBlogPost(post: {
    _id: string
    title: string
    excerpt: string
    body: string
    published: boolean
    featured: boolean
    image: string | null
  }) {
    blogPostForm.value = {
      postId: post._id,
      title: post.title,
      excerpt: post.excerpt,
      body: post.body,
      published: post.published,
      featured: post.featured,
    }
    img.clearImage()
    img.setPreview(post.image)
    activeTab.value = 'blog'
  }

  async function handleSaveBlogPost() {
    savingBlogPost.value = true
    try {
      const imageStorageId = img.file.value ? await uploadImageFile(img.file.value, () => generateImageUploadUrl({})) : undefined
      await saveBlogPost({
        title: blogPostForm.value.title,
        excerpt: blogPostForm.value.excerpt,
        body: blogPostForm.value.body,
        published: blogPostForm.value.published,
        featured: blogPostForm.value.featured,
        ...(blogPostForm.value.postId ? { postId: blogPostForm.value.postId as Id<'blogPosts'> } : {}),
        ...(imageStorageId ? { imageStorageId: imageStorageId as Id<'_storage'> } : {}),
      })
      toast.success(blogPostForm.value.postId ? 'Artikel blog diperbarui' : 'Artikel blog dibuat')
      resetBlogPostForm()
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Gagal menyimpan artikel blog'))
    } finally {
      savingBlogPost.value = false
    }
  }

  async function handleDeleteBlogPost(postId: string) {
    deletingBlogPostId.value = postId
    try {
      await deleteBlogPost({ postId: postId as Id<'blogPosts'> })
      if (blogPostForm.value.postId === postId) resetBlogPostForm()
      toast.success('Artikel blog dihapus')
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Gagal menghapus artikel blog'))
    } finally {
      deletingBlogPostId.value = null
    }
  }

  return {
    blogPostForm,
    savingBlogPost,
    deletingBlogPostId,
    blogImageFile: img.file,
    blogImagePreview: img.preview,
    blogImageBlobUrl: img.blobUrl,
    renderedBlogPreview,
    resetBlogPostForm,
    editBlogPost,
    handleSaveBlogPost,
    handleDeleteBlogPost,
    handleBlogImageChange: img.handleImageChange,
  }
}
