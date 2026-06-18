<script setup lang="ts">
import { useAdmin } from '@/composables/useAdmin'

definePageMeta({ requiresAuth: true })

const {
  data, activeTab, tabs,
  deviceForm, productForm, plantPresetForm, blogPostForm,
  supportReplyInput,
  savingDevice, deletingDeviceId,
  savingProduct, deletingProductId, updatingProductId,
  updatingUserId, updatingTicketId, sendingTicketMessage,
  selectedSupportRequest, selectedSupportRequestId,
  productImagePreview,
  savingPlantPreset, deletingPlantPresetId,
  plantPresetImagePreview,
  savingBlogPost, deletingBlogPostId,
  blogImagePreview,
  renderedBlogPreview,
  supportQueue,
  resetDeviceForm, editDevice,
  resetProductForm, editProduct,
  resetPlantPresetForm, editPlantPreset,
  editBlogPost,
  handleProductImageChange, handlePlantPresetImageChange, handleBlogImageChange,
  handleSaveDevice, handleDeleteDevice,
  handleTicketUpdate, handleSendTicketMessage,
  handleSaveProduct, handleSavePlantPreset, handleDeletePlantPreset,
  handleSaveBlogPost, handleDeleteBlogPost,
  handleUserAccessChange,
  handleUpdateProductStatus, handleDeleteProduct,
} = useAdmin()
</script>

<template>
  <div v-if="data" class="space-y-6 pb-20 md:pb-0">
    <section class="rounded-[2rem] bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)] sm:p-8">
      <p class="text-xs font-bold uppercase tracking-[0.2em] text-gm-primary">Kontrol Admin</p>
      <h1 class="mt-2 font-headline text-3xl font-black tracking-tight text-gm-text">Operasi ekosistem</h1>
      <p class="mt-2 max-w-3xl text-sm text-gm-muted">Halaman ini membantu admin mengawasi operasional GrowMate, mulai dari kesiapan perangkat, alur dukungan pengguna, katalog produk resmi, artikel edukasi, hingga pengelolaan akses akun.</p>
      <div class="mt-6 grid gap-3 md:grid-cols-3 xl:grid-cols-9">
        <article class="rounded-[1.5rem] bg-[#f3f3f3] p-4"><div class="text-xs font-bold uppercase tracking-[0.18em] text-gm-muted">Pengguna</div><div class="mt-2 text-3xl font-black text-gm-text">{{ data.stats.totalUsers }}</div></article>
        <article class="rounded-[1.5rem] bg-[#f3f3f3] p-4"><div class="text-xs font-bold uppercase tracking-[0.18em] text-gm-muted">Perangkat</div><div class="mt-2 text-3xl font-black text-gm-text">{{ data.stats.totalDevices }}</div></article>
        <article class="rounded-[1.5rem] bg-[#f3f3f3] p-4"><div class="text-xs font-bold uppercase tracking-[0.18em] text-gm-muted">Diklaim</div><div class="mt-2 text-3xl font-black text-gm-text">{{ data.stats.claimedDevices }}</div></article>
        <article class="rounded-[1.5rem] bg-[#f3f3f3] p-4"><div class="text-xs font-bold uppercase tracking-[0.18em] text-gm-muted">Tanaman Aktif</div><div class="mt-2 text-3xl font-black text-gm-text">{{ data.stats.activePlants }}</div></article>
        <article class="rounded-[1.5rem] bg-[#f3f3f3] p-4"><div class="text-xs font-bold uppercase tracking-[0.18em] text-gm-muted">Tiket Terbuka</div><div class="mt-2 text-3xl font-black text-gm-text">{{ data.stats.openTickets }}</div></article>
        <article class="rounded-[1.5rem] bg-[#f3f3f3] p-4"><div class="text-xs font-bold uppercase tracking-[0.18em] text-gm-muted">Produk Resmi</div><div class="mt-2 text-3xl font-black text-gm-text">{{ data.stats.officialProducts }}</div></article>
        <article class="rounded-[1.5rem] bg-[#f3f3f3] p-4"><div class="text-xs font-bold uppercase tracking-[0.18em] text-gm-muted">Listing Komunitas</div><div class="mt-2 text-3xl font-black text-gm-text">{{ data.stats.communityListings }}</div></article>
        <article class="rounded-[1.5rem] bg-[#f3f3f3] p-4"><div class="text-xs font-bold uppercase tracking-[0.18em] text-gm-muted">Postingan Komunitas</div><div class="mt-2 text-3xl font-black text-gm-text">{{ data.stats.communityPosts }}</div></article>
        <article class="rounded-[1.5rem] bg-[#f3f3f3] p-4"><div class="text-xs font-bold uppercase tracking-[0.18em] text-gm-muted">Artikel Edukasi</div><div class="mt-2 text-3xl font-black text-gm-text">{{ data.stats.blogPosts }}</div></article>
      </div>
    </section>

    <section class="rounded-[1.75rem] bg-[#f3f3f3] p-2 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
      <div class="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
        <button v-for="tab in tabs" :key="tab.key" type="button" class="rounded-[1.25rem] px-3 py-3 text-xs font-bold uppercase tracking-[0.18em]" :class="activeTab === tab.key ? 'bg-white text-gm-primary shadow-[0_10px_20px_rgba(15,23,42,0.06)]' : 'text-gm-muted'" @click="activeTab = tab.key">{{ tab.label }}</button>
      </div>
    </section>

    <AdminOverview v-if="activeTab === 'overview'" :support-queue="supportQueue" :devices="data.devices" :recent-events="data.recentEvents" @edit-device="editDevice" />

    <AdminDevices v-else-if="activeTab === 'devices'" :device-form="deviceForm" :saving-device="savingDevice" :deleting-device-id="deletingDeviceId" :devices="data.devices" :plant-presets="data.plantCatalog" @update:device-form="deviceForm = $event" @save-device="handleSaveDevice" @delete-device="handleDeleteDevice" @edit-device="editDevice" @reset-device-form="resetDeviceForm" />

    <AdminSupport v-else-if="activeTab === 'support'" :support-queue="supportQueue" :selected-support-request="selectedSupportRequest" :selected-support-request-id="selectedSupportRequestId" :support-reply-input="supportReplyInput" :updating-ticket-id="updatingTicketId" :sending-ticket-message="sendingTicketMessage" @update:selected-support-request-id="selectedSupportRequestId = $event" @update:support-reply-input="supportReplyInput = $event" @send-reply="handleSendTicketMessage" @update-ticket="handleTicketUpdate" />

    <AdminProducts v-else-if="activeTab === 'products'" :product-form="productForm" :product-image-preview="productImagePreview" :saving-product="savingProduct" :deleting-product-id="deletingProductId" :updating-product-id="updatingProductId" :product-list="data.officialProducts" @update:product-form="productForm = $event" @save-product="handleSaveProduct" @delete-product="handleDeleteProduct" @edit-product="editProduct" @reset-product-form="resetProductForm" @handle-product-image-change="handleProductImageChange" @update-product-status="handleUpdateProductStatus" />

    <AdminPlants v-else-if="activeTab === 'plants'" :plant-preset-form="plantPresetForm" :plant-preset-image-preview="plantPresetImagePreview" :saving-plant-preset="savingPlantPreset" :deleting-plant-preset-id="deletingPlantPresetId" :plant-preset-list="data.plantCatalog" @update:plant-preset-form="plantPresetForm = $event" @save-plant-preset="handleSavePlantPreset" @delete-plant-preset="handleDeletePlantPreset" @edit-plant-preset="editPlantPreset" @reset-plant-preset-form="resetPlantPresetForm" @handle-plant-preset-image-change="handlePlantPresetImageChange" />

    <AdminBlog v-else-if="activeTab === 'blog'" :blog-post-form="blogPostForm" :blog-image-preview="blogImagePreview" :saving-blog-post="savingBlogPost" :deleting-blog-post-id="deletingBlogPostId" :blog-post-list="data.blogPosts" :rendered-blog-preview="renderedBlogPreview" @update:blog-post-form="blogPostForm = $event" @save-blog-post="handleSaveBlogPost" @delete-blog-post="handleDeleteBlogPost" @edit-blog-post="editBlogPost" @reset-blog-post-form="resetBlogPostForm" @handle-blog-image-change="handleBlogImageChange" />

    <AdminAccounts v-else-if="activeTab === 'accounts'" :user-list="data.users" :updating-user-id="updatingUserId" @update-user-access="handleUserAccessChange" />
  </div>
</template>
