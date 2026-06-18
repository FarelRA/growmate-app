import { ref } from 'vue'
import type { Ref } from 'vue'
import { useConvexMutation } from '@convex-vue/core'
import { toast } from 'vue-sonner'
import { api } from '@/lib/api'
import { getErrorMessage } from '@/lib/errors'
import type { Id } from '@/lib/convex-types'
import { uploadImageFile } from '@/lib/uploads'
import { useImageUpload } from './useImageUpload'
import type { AdminTab } from './useAdminDevices'

export function useAdminProducts(activeTab: Ref<AdminTab>) {
  const { mutate: saveOfficialProduct } = useConvexMutation(api.admin.adminSaveOfficialProduct)
  const { mutate: updateOfficialProductStatus } = useConvexMutation(api.admin.adminUpdateOfficialProductStatus)
  const { mutate: deleteOfficialProduct } = useConvexMutation(api.admin.adminDeleteOfficialProduct)
  const { mutate: generateImageUploadUrl } = useConvexMutation(api.images.generateImageUploadUrl)

  const img = useImageUpload()

  const savingProduct = ref(false)
  const deletingProductId = ref<string | null>(null)
  const updatingProductId = ref<string | null>(null)

  const productForm = ref({
    productId: null as string | null,
    title: '',
    description: '',
    price: 0,
    category: 'Grow Kit',
    quantityAvailable: 1,
    priceUnit: 'item',
    featured: false,
    status: 'active' as 'active' | 'reserved' | 'sold' | 'archived',
    shopeeUrl: '',
  })

  function resetProductForm() {
    productForm.value = {
      productId: null,
      title: '',
      description: '',
      price: 0,
      category: 'Grow Kit',
      quantityAvailable: 1,
      priceUnit: 'item',
      featured: false,
      status: 'active',
      shopeeUrl: '',
    }
    img.clearImage()
  }

  function editProduct(product: {
    _id: string
    title: string
    description: string
    price: number
    category: string
    quantityAvailable: number
    priceUnit: string
    featured: boolean
    status: 'active' | 'reserved' | 'sold' | 'archived'
    shopeeUrl: string | null
    image: string | null
  }) {
    productForm.value = {
      productId: product._id,
      title: product.title,
      description: product.description,
      price: product.price,
      category: product.category,
      quantityAvailable: product.quantityAvailable,
      priceUnit: product.priceUnit,
      featured: product.featured,
      status: product.status,
      shopeeUrl: product.shopeeUrl ?? '',
    }
    img.clearImage()
    img.setPreview(product.image)
    activeTab.value = 'products'
  }

  async function handleSaveProduct() {
    savingProduct.value = true
    try {
      const imageStorageId = img.file.value ? await uploadImageFile(img.file.value, () => generateImageUploadUrl({}) as Promise<string>) : undefined
      await saveOfficialProduct({
        title: productForm.value.title,
        description: productForm.value.description,
        price: Number(productForm.value.price),
        category: productForm.value.category,
        quantityAvailable: Number(productForm.value.quantityAvailable),
        priceUnit: productForm.value.priceUnit,
        featured: productForm.value.featured,
        status: productForm.value.status,
        shopeeUrl: productForm.value.shopeeUrl || undefined,
        ...(productForm.value.productId ? { productId: productForm.value.productId as Id<'products'> } : {}),
        ...(imageStorageId ? { imageStorageId: imageStorageId as Id<'_storage'> } : {}),
      })
      toast.success(productForm.value.productId ? 'Produk resmi diperbarui' : 'Produk resmi dibuat')
      resetProductForm()
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Gagal menyimpan produk'))
    } finally {
      savingProduct.value = false
    }
  }

  async function handleUpdateProductStatus(productId: string, status: 'active' | 'reserved' | 'sold' | 'archived') {
    updatingProductId.value = productId
    try {
      await updateOfficialProductStatus({ productId: productId as Id<'products'>, status })
      toast.success(`Status produk resmi diperbarui menjadi ${status}`)
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Gagal memperbarui status produk'))
    } finally {
      updatingProductId.value = null
    }
  }

  async function handleDeleteProduct(productId: string) {
    deletingProductId.value = productId
    try {
      await deleteOfficialProduct({ productId: productId as Id<'products'> })
      if (productForm.value.productId === productId) resetProductForm()
      toast.success('Produk resmi dihapus')
    } catch (error: unknown) {
      toast.error(getErrorMessage(error, 'Gagal menghapus produk'))
    } finally {
      deletingProductId.value = null
    }
  }

  return {
    productForm,
    savingProduct,
    deletingProductId,
    updatingProductId,
    productImageFile: img.file,
    productImagePreview: img.preview,
    productImageBlobUrl: img.blobUrl,
    resetProductForm,
    editProduct,
    handleSaveProduct,
    handleUpdateProductStatus,
    handleDeleteProduct,
    handleProductImageChange: img.handleImageChange,
  }
}
