<script setup lang="ts">
const props = defineProps<{
  blogPostForm: {
    postId: string | null
    title: string
    excerpt: string
    body: string
    published: boolean
    featured: boolean
  }
  blogImagePreview: string | null
  savingBlogPost: boolean
  deletingBlogPostId: string | null
  blogPostList: { _id: string; image: string; title: string; relativeTime: string; published: boolean; authorName: string }[]
  renderedBlogPreview: string
}>()
const emit = defineEmits<{
  saveBlogPost: []
  deleteBlogPost: [id: string]
  editBlogPost: [post: object]
  resetBlogPostForm: []
  handleBlogImageChange: [event: Event]
  'update:blogPostForm': [form: object]
}>()
</script>

<template>
  <section class="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
    <article class="rounded-[2rem] bg-white p-6 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
      <div class="flex items-center justify-between gap-3">
        <h2 class="font-headline text-2xl font-bold text-gm-text">Blog publik</h2>
      </div>
      <div class="mt-5 grid gap-3">
        <label class="space-y-2"><span class="block text-sm font-semibold text-gm-text">Judul artikel</span><input :value="props.blogPostForm.title" class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" placeholder="Judul artikel" @input="emit('update:blogPostForm', { ...props.blogPostForm, title: ($event.target as HTMLInputElement).value })" /></label>
        <label class="space-y-2"><span class="block text-sm font-semibold text-gm-text">Ringkasan singkat</span><textarea :value="props.blogPostForm.excerpt" rows="3" class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" placeholder="Ringkasan untuk kartu blog dan halaman indeks" @input="emit('update:blogPostForm', { ...props.blogPostForm, excerpt: ($event.target as HTMLInputElement).value })" /></label>
        <label class="space-y-2"><span class="block text-sm font-semibold text-gm-text">Isi artikel</span><textarea :value="props.blogPostForm.body" rows="14" class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" placeholder="# Judul bagian\n\nTulis artikel dengan Markdown di sini...\n\n- daftar poin\n- daftar poin lain\n\n**teks tebal** dan [tautan](https://example.com)" @input="emit('update:blogPostForm', { ...props.blogPostForm, body: ($event.target as HTMLInputElement).value })" /><p class="text-xs leading-relaxed text-gm-muted">Mendukung Markdown seperti heading, list, bold, italic, quote, link, dan code block.</p></label>
        <label class="space-y-2"><span class="block text-sm font-semibold text-gm-text">Cover artikel</span><input type="file" accept="image/*" class="w-full rounded-2xl bg-[#f7f7f7] px-4 py-3 text-sm outline-none" @change="emit('handleBlogImageChange', $event)" /></label>
        <img v-if="props.blogImagePreview" :src="props.blogImagePreview" alt="Pratinjau blog" class="h-48 w-full rounded-[1.5rem] object-cover" />
      </div>
      <div class="mt-5 flex flex-wrap gap-3">
        <label class="flex items-center gap-2 rounded-full bg-[#f3f3f3] px-4 py-3 text-sm font-semibold text-gm-text"><input :checked="props.blogPostForm.featured" type="checkbox" @change="emit('update:blogPostForm', { ...props.blogPostForm, featured: ($event.target as HTMLInputElement).checked })" /> Artikel unggulan</label>
        <label class="flex items-center gap-2 rounded-full bg-[#f3f3f3] px-4 py-3 text-sm font-semibold text-gm-text"><input :checked="props.blogPostForm.published" type="checkbox" @change="emit('update:blogPostForm', { ...props.blogPostForm, published: ($event.target as HTMLInputElement).checked })" /> Publikasikan artikel</label>
      </div>
      <button class="mt-5 rounded-full bg-gm-primary px-6 py-3 text-sm font-bold text-white disabled:opacity-50" :disabled="props.savingBlogPost" @click="emit('saveBlogPost')">{{ props.savingBlogPost ? 'Menyimpan...' : props.blogPostForm.postId ? 'Perbarui artikel' : 'Buat artikel' }}</button>
      <div class="mt-8"><div class="mb-3 text-sm font-semibold text-gm-text">Pratinjau Markdown</div><div class="gm-article rounded-[2rem] bg-[#f8faf7] p-6 text-gm-muted" v-html="props.renderedBlogPreview" /></div>
    </article>
    <article class="space-y-4">
      <article v-for="post in props.blogPostList" :key="post._id" class="rounded-[2rem] bg-white p-5 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
        <div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div class="flex gap-4">
            <img :src="post.image" :alt="post.title" class="h-20 w-20 rounded-[1.25rem] object-cover" />
            <div><div class="text-lg font-bold text-gm-text">{{ post.title }}</div><div class="mt-1 text-sm text-gm-muted">{{ post.relativeTime }} • {{ post.published ? 'Published' : 'Draft' }}</div><div class="mt-1 text-xs text-gm-muted">{{ post.authorName }}</div></div>
          </div>
          <div class="flex flex-wrap gap-2">
            <button class="rounded-full bg-[#f3f3f3] px-4 py-2 text-xs font-bold text-gm-text" @click="emit('editBlogPost', post)">Edit</button>
            <button class="rounded-full bg-[#ffdbcf] px-4 py-2 text-xs font-bold text-[#795548] disabled:opacity-50" :disabled="props.deletingBlogPostId === post._id" @click="emit('deleteBlogPost', post._id)">{{ props.deletingBlogPostId === post._id ? 'Menghapus...' : 'Hapus' }}</button>
          </div>
        </div>
      </article>
    </article>
  </section>
</template>
