<script setup lang="ts">
/* eslint-disable @typescript-eslint/no-explicit-any */
const props = defineProps<{
  productForm: {
    productId: string | null
    title: string
    description: string
    price: number
    category: string
    quantityAvailable: number
    priceUnit: string
    featured: boolean
    status: 'archived' | 'active' | 'reserved' | 'sold'
    shopeeUrl: string
  }
  productImagePreview: string | null
  savingProduct: boolean
  deletingProductId: string | null
  updatingProductId: string | null
  productList: any[]
}>()
const emit = defineEmits<{
  saveProduct: []
  deleteProduct: [id: string]
  editProduct: [product: any]
  resetProductForm: []
  handleProductImageChange: [event: Event]
  updateProductStatus: [productId: string, status: 'active' | 'reserved' | 'sold' | 'archived']
  'update:productForm': [form: { productId: string | null; title: string; description: string; price: number; category: string; quantityAvailable: number; priceUnit: string; featured: boolean; status: 'archived' | 'active' | 'reserved' | 'sold'; shopeeUrl: string }]
}>()
</script>

<template>
  <section class="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
    <article class="rounded-[2rem] bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
      <div class="flex items-center justify-between gap-3">
        <h2 class="font-headline text-2xl font-bold text-gm-text">{{ props.productForm.productId ? 'Edit produk' : 'Tambah produk' }}</h2>
        <button v-if="props.productForm.productId" class="rounded-full bg-[#f3f3f3] px-4 py-2 text-xs font-bold text-gm-text" @click="emit('resetProductForm')">Batal</button>
      </div>
      <div class="mt-5 grid gap-3">
        <label class="space-y-2"><span class="block text-sm font-semibold text-gm-text">Judul produk</span><input :value="props.productForm.title" class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" placeholder="Nama produk" @input="emit('update:productForm', { ...props.productForm, title: ($event.target as HTMLInputElement).value })" /></label>
        <label class="space-y-2"><span class="block text-sm font-semibold text-gm-text">Deskripsi</span><textarea :value="props.productForm.description" rows="4" class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" placeholder="Deskripsi produk" @input="emit('update:productForm', { ...props.productForm, description: ($event.target as HTMLInputElement).value })" /></label>
        <div class="grid gap-3 sm:grid-cols-2">
          <label class="space-y-2"><span class="block text-sm font-semibold text-gm-text">Harga</span><input :value="props.productForm.price" type="number" class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" @input="emit('update:productForm', { ...props.productForm, price: Number(($event.target as HTMLInputElement).value) })" /></label>
          <label class="space-y-2"><span class="block text-sm font-semibold text-gm-text">Kategori</span><input :value="props.productForm.category" class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" placeholder="Kategori" @input="emit('update:productForm', { ...props.productForm, category: ($event.target as HTMLInputElement).value })" /></label>
          <label class="space-y-2"><span class="block text-sm font-semibold text-gm-text">Jumlah tersedia</span><input :value="props.productForm.quantityAvailable" type="number" class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" @input="emit('update:productForm', { ...props.productForm, quantityAvailable: Number(($event.target as HTMLInputElement).value) })" /></label>
          <label class="space-y-2"><span class="block text-sm font-semibold text-gm-text">Satuan</span><input :value="props.productForm.priceUnit" class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" placeholder="item" @input="emit('update:productForm', { ...props.productForm, priceUnit: ($event.target as HTMLInputElement).value })" /></label>
        </div>
        <label class="space-y-2"><span class="block text-sm font-semibold text-gm-text">Gambar produk</span><input type="file" accept="image/*" class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" @change="emit('handleProductImageChange', $event)" /></label>
        <img v-if="props.productImagePreview" :src="props.productImagePreview" alt="Preview" class="h-48 w-full rounded-[1.5rem] object-cover" />
        <label class="space-y-2"><span class="block text-sm font-semibold text-gm-text">URL Shopee (opsional)</span><input :value="props.productForm.shopeeUrl" class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" placeholder="https://shopee.co.id/..." @input="emit('update:productForm', { ...props.productForm, shopeeUrl: ($event.target as HTMLInputElement).value })" /></label>
        <label class="mt-2 flex items-center gap-2 rounded-full bg-[#f3f3f3] px-4 py-3 text-sm font-semibold text-gm-text"><input :checked="props.productForm.featured" type="checkbox" @change="emit('update:productForm', { ...props.productForm, featured: ($event.target as HTMLInputElement).checked })" /> Produk unggulan</label>
        <label class="space-y-2"><span class="block text-sm font-semibold text-gm-text">Status</span><select :value="props.productForm.status" class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" @change="emit('update:productForm', { ...props.productForm, status: ($event.target as HTMLSelectElement).value as 'archived' | 'active' | 'reserved' | 'sold' })"><option value="active">Aktif</option><option value="reserved">Dipesan</option><option value="sold">Terjual</option><option value="archived">Diarsipkan</option></select></label>
      </div>
      <button class="mt-5 rounded-full bg-gm-primary px-6 py-3 text-sm font-bold text-white disabled:opacity-50" :disabled="props.savingProduct" @click="emit('saveProduct')">{{ props.savingProduct ? 'Menyimpan...' : props.productForm.productId ? 'Perbarui produk' : 'Buat produk' }}</button>
    </article>
    <article class="space-y-4">
      <article v-for="product in props.productList" :key="product._id" class="rounded-[2rem] bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
        <div class="flex gap-4">
          <img :src="product.imageUrl ?? undefined" :alt="product.title" class="h-20 w-20 shrink-0 rounded-[1.25rem] object-cover" />
          <div class="min-w-0 flex-1">
            <div class="text-lg font-bold text-gm-text">{{ product.title }}</div>
            <div class="mt-1 text-sm text-gm-muted">{{ product.priceLabel }} • {{ product.statusLabel }}</div>
            <div class="mt-1 text-xs text-gm-muted truncate">{{ product.description }}</div>
          </div>
        </div>
        <div class="mt-3 flex flex-wrap gap-2">
          <button class="rounded-full bg-[#f3f3f3] px-4 py-2 text-xs font-bold text-gm-text" @click="emit('editProduct', product)">Edit</button>
          <select aria-label="Status produk" class="rounded-2xl bg-[#f7f7f7] px-4 py-2 text-xs font-semibold text-gm-text outline-none" :value="product.status" :disabled="props.updatingProductId === product._id" @change="emit('updateProductStatus', product._id, ($event.target as HTMLSelectElement).value as 'active' | 'reserved' | 'sold' | 'archived')"><option value="active">Aktif</option><option value="reserved">Dipesan</option><option value="sold">Terjual</option><option value="archived">Diarsipkan</option></select>
          <button class="rounded-full bg-[#ffdbcf] px-4 py-2 text-xs font-bold text-[#795548] disabled:opacity-50" :disabled="props.deletingProductId === product._id" @click="emit('deleteProduct', product._id)">{{ props.deletingProductId === product._id ? 'Menghapus...' : 'Hapus' }}</button>
        </div>
      </article>
    </article>
  </section>
</template>
