<script setup lang="ts">
import { ref } from 'vue'
import { useConvexMutation, useConvexQuery } from '@convex-vue/core'
import { toast } from 'vue-sonner'
import { api } from '@/lib/api'
import { getErrorMessage } from '@/lib/errors'
import { readSelectedImage, uploadImageFile } from '@/lib/uploads'

definePageMeta({
  requiresAuth: true,
  requiresSetup: true,
})

const { data } = useConvexQuery(api.growmate.community, {})

const { mutate: createPost } = useConvexMutation(api.growmate.createPost)
const { mutate: likePost } = useConvexMutation(api.growmate.likePost)
const { mutate: createComment } = useConvexMutation(api.growmate.createComment)
const { mutate: deletePost } = useConvexMutation(api.growmate.deletePost)
const { mutate: generateImageUploadUrl } = useConvexMutation(api.growmate.generateImageUploadUrl)

const showCreatePostModal = ref(false)
const expandedComments = ref<string | null>(null)
const newPostTitle = ref('')
const newPostBody = ref('')
const newPostImagePreview = ref<string | null>(null)
const commentText = ref<Record<string, string>>({})

const creatingPost = ref(false)
const likingPosts = ref<Set<string>>(new Set())
const commentingPosts = ref<Set<string>>(new Set())
const deletingPosts = ref<Set<string>>(new Set())

async function handleCreatePost() {
  creatingPost.value = true
  try {
    const imageStorageId = newPostImageFile.value
      ? await uploadImageFile(newPostImageFile.value, () => generateImageUploadUrl({}))
      : undefined

    await createPost({
      title: newPostTitle.value,
      body: newPostBody.value,
      imageStorageId: imageStorageId as never,
    })
    toast.success('Post published')
    newPostTitle.value = ''
    newPostBody.value = ''
    newPostImageFile.value = null
    newPostImagePreview.value = null
    showCreatePostModal.value = false
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, 'Failed to publish post'))
  } finally {
    creatingPost.value = false
  }
}

const newPostImageFile = ref<File | null>(null)

function handlePostImageChange(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  newPostImageFile.value = file
  newPostImagePreview.value = readSelectedImage(file)
}

async function handleLike(postId: string) {
  likingPosts.value.add(postId)
  try {
    const result = await likePost({ postId: postId as never })
    toast.success(result.liked ? 'Post liked' : 'Like removed')
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, 'Failed to update like'))
  } finally {
    likingPosts.value.delete(postId)
  }
}

async function handleComment(postId: string) {
  commentingPosts.value.add(postId)
  try {
    await createComment({ postId: postId as never, body: commentText.value[postId] ?? '' })
    commentText.value[postId] = ''
    expandedComments.value = postId
    toast.success('Comment posted')
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, 'Failed to post comment'))
  } finally {
    commentingPosts.value.delete(postId)
  }
}

async function handleDeletePost(postId: string) {
  if (!window.confirm('Delete this post? This cannot be undone.')) {
    return
  }

  deletingPosts.value.add(postId)
  try {
    await deletePost({ postId: postId as never })
    toast.success('Post deleted')
  } catch (error: unknown) {
    toast.error(getErrorMessage(error, 'Failed to delete post'))
  } finally {
    deletingPosts.value.delete(postId)
  }
}

</script>

<template>
  <div v-if="data" class="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
    <div class="space-y-8">
      <section class="rounded-[2rem] bg-white p-5 sm:p-8 shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
        <div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p class="text-xs font-bold uppercase tracking-[0.24em] text-gm-primary">Community</p>
            <h1 class="mt-2 font-headline text-3xl font-black tracking-tight text-gm-text sm:text-4xl">A grower community feed.</h1>
            <p class="mt-3 max-w-3xl text-sm leading-relaxed text-gm-muted">Post updates, react to other growers, and discuss actual plant progress in threaded comments.</p>
          </div>
          <button @click="showCreatePostModal = true" class="rounded-full bg-gm-primary px-6 py-3 text-sm font-bold text-white">Create Post</button>
        </div>
      </section>

      <div v-if="!data.posts.length" class="rounded-[2rem] bg-[#f3f3f3] p-8 text-center text-sm text-gm-muted">
        No community posts yet. Publish the first grow update.
      </div>

      <article v-for="post in data.posts" :key="post._id" class="rounded-[2rem] bg-white p-5 sm:p-6 shadow-[0_12px_40px_rgba(15,23,42,0.05)]">
        <div class="flex items-start justify-between gap-4">
          <div class="flex items-center gap-4">
            <div class="flex h-12 w-12 items-center justify-center rounded-full bg-gm-primary text-xs font-bold text-white">{{ post.user?.avatar || 'GM' }}</div>
            <div>
              <div class="text-sm font-bold text-gm-text">{{ post.user?.name || 'GrowMate member' }}</div>
              <div class="text-xs text-gm-muted">{{ post.timestamp }}</div>
            </div>
          </div>
          <button v-if="data.viewerId && data.viewerId === post.userId" @click="handleDeletePost(post._id)" class="rounded-full bg-[#ffdbcf] px-4 py-2 text-xs font-bold text-[#795548] disabled:opacity-50" :disabled="deletingPosts.has(post._id)">
            {{ deletingPosts.has(post._id) ? 'Deleting...' : 'Delete' }}
          </button>
        </div>

        <div class="mt-5 space-y-4">
          <div>
            <h2 class="font-headline text-2xl font-bold text-gm-text">{{ post.title }}</h2>
            <p class="mt-3 text-sm leading-relaxed text-gm-muted">{{ post.body }}</p>
          </div>
          <img v-if="post.image" :src="post.image" :alt="post.title" class="h-64 w-full rounded-[1.5rem] object-cover sm:h-[360px]" />
        </div>

        <div class="mt-6 flex flex-wrap items-center gap-3 pt-4 text-sm">
          <button @click="handleLike(post._id)" class="flex items-center gap-2 rounded-full px-4 py-2 font-semibold" :class="post.viewerHasLiked ? 'bg-[#ffe5ea] text-[#c2415d]' : 'bg-[#f3f3f3] text-gm-muted'" :disabled="likingPosts.has(post._id)">
            <span class="material-symbols-outlined text-sm">favorite</span>
            {{ post.likeCount }}
          </button>
          <button @click="expandedComments = expandedComments === post._id ? null : post._id" class="flex items-center gap-2 rounded-full bg-[#f3f3f3] px-4 py-2 font-semibold text-gm-muted">
            <span class="material-symbols-outlined text-sm">chat_bubble</span>
            {{ post.commentCount }} comments
          </button>
        </div>

        <div class="mt-5 rounded-[1.5rem] bg-[#f7f7f7] p-4">
          <div class="flex flex-col gap-3 sm:flex-row">
            <input v-model="commentText[post._id]" @keyup.enter="!commentingPosts.has(post._id) && handleComment(post._id)" class="flex-1 rounded-full bg-white px-5 py-3 text-sm outline-none" placeholder="Add a thoughtful comment..." />
            <button @click="handleComment(post._id)" class="rounded-full bg-gm-primary px-5 py-3 text-sm font-bold text-white" :disabled="commentingPosts.has(post._id)">
              {{ commentingPosts.has(post._id) ? 'Posting...' : 'Comment' }}
            </button>
          </div>

          <div v-if="expandedComments === post._id" class="mt-4 space-y-3">
            <div v-for="comment in post.comments" :key="comment._id" class="rounded-[1.25rem] bg-white p-4">
              <div class="flex items-center gap-3">
                <div class="flex h-9 w-9 items-center justify-center rounded-full bg-[#e8e8e8] text-[11px] font-bold text-gm-text">{{ comment.user?.avatar || 'CM' }}</div>
                <div>
                  <div class="text-sm font-bold text-gm-text">{{ comment.user?.name || 'Community member' }}</div>
                  <div class="text-[11px] text-gm-muted">{{ comment.createdAtLabel }}</div>
                </div>
              </div>
              <p class="mt-3 text-sm leading-relaxed text-gm-muted">{{ comment.body }}</p>
            </div>

            <div v-if="!post.comments.length" class="rounded-[1.25rem] bg-white p-4 text-sm text-gm-muted">
              No comments yet. Start the discussion.
            </div>
          </div>
        </div>
      </article>
    </div>

    <div class="space-y-8">
      <section class="rounded-[2rem] bg-[#e8e8e8] p-5 sm:p-6">
        <div class="mb-6 flex items-center justify-between">
          <h2 class="font-headline text-lg font-bold text-gm-text">Top Growers</h2>
          <span class="text-[10px] font-bold uppercase tracking-[0.18em] text-gm-muted">Leaderboard</span>
        </div>
        <div class="space-y-4">
          <div v-for="(user, index) in data.leaderboard" :key="user._id" class="flex items-center gap-4 rounded-[1.25rem] bg-white p-3">
            <div class="w-8 text-center font-headline text-lg font-black text-gm-primary">#{{ index + 1 }}</div>
            <div class="flex h-10 w-10 items-center justify-center rounded-full bg-gm-primary text-xs font-bold text-white">{{ user.avatar }}</div>
            <div class="flex-1">
              <div class="text-sm font-bold text-gm-text">{{ user.name }}</div>
              <div class="text-[11px] text-gm-muted">{{ user.points }} growth points</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  </div>

  <div v-if="showCreatePostModal" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 backdrop-blur-sm" @click="showCreatePostModal = false">
    <div class="w-full max-w-2xl rounded-[2rem] bg-white p-5 sm:p-8 shadow-2xl" @click.stop>
      <div class="flex items-center justify-between gap-4">
        <div>
          <h2 class="font-headline text-2xl font-bold text-gm-text">Create Community Post</h2>
          <p class="mt-1 text-sm text-gm-muted">Share a grow update, lesson learned, or harvest moment.</p>
        </div>
        <button class="rounded-full p-2 hover:bg-[#f3f3f3]" @click="showCreatePostModal = false">
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>
      <div class="mt-6 space-y-4">
        <input v-model="newPostTitle" class="w-full rounded-2xl bg-[#f7f7f7] px-5 py-3 text-sm outline-none" placeholder="Post title" />
        <textarea v-model="newPostBody" rows="7" class="w-full rounded-2xl bg-[#f7f7f7] px-5 py-4 text-sm outline-none" placeholder="Tell the community what happened, what you learned, and what others should watch for..." />
        <label class="block rounded-2xl bg-[#f7f7f7] px-5 py-4 text-sm text-gm-muted">
          <span class="mb-2 block font-semibold text-gm-text">Optional image</span>
          <input type="file" accept="image/*" class="block w-full" @change="handlePostImageChange" />
        </label>
        <img v-if="newPostImagePreview" :src="newPostImagePreview" alt="Selected post image" class="h-56 w-full rounded-[1.5rem] object-cover" />
      </div>
      <div class="mt-6 flex flex-col gap-3 sm:flex-row">
        <button @click="handleCreatePost" class="flex-1 rounded-full bg-gm-primary px-6 py-4 text-sm font-bold text-white" :disabled="creatingPost">{{ creatingPost ? 'Publishing...' : 'Publish Post' }}</button>
        <button @click="showCreatePostModal = false" class="rounded-full bg-[#e8e8e8] px-6 py-4 text-sm font-bold text-gm-text">Cancel</button>
      </div>
    </div>
  </div>
</template>
