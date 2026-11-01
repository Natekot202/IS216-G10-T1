<script setup>
// A task's reference photos, to look at: small pictures with captions, and tap one to see it full screen.
import { ref } from 'vue'

defineProps({
  photos: { type: Array, required: true } // [{ _id, url, caption }]
})

const open = ref(null) // the photo showing full screen
</script>

<template>
  <div class="tp">
    <button v-for="p in photos" :key="p._id ?? p.url" type="button" class="tp-item" @click="open = p">
      <img :src="p.url" :alt="p.caption || 'Reference photo'" class="tp-img" loading="lazy" />
      <small v-if="p.caption" class="tp-caption">{{ p.caption }}</small>
    </button>

    <div v-if="open" class="tp-full" role="dialog" aria-label="Reference photo" tabindex="-1"
         @click.self="open = null" @keydown.esc="open = null">
      <button type="button" class="btn-close btn-close-white tp-close" aria-label="Close photo" @click="open = null"></button>
      <img :src="open.url" :alt="open.caption || 'Reference photo'" class="tp-full__img" />
      <p v-if="open.caption" class="tp-full__caption">{{ open.caption }}</p>
    </div>
  </div>
</template>

<style scoped>
.tp {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.4rem;
}
.tp-item {
  width: 4.5rem;
  padding: 0;
  border: 0;
  background: none;
  text-align: left;
}
.tp-img {
  display: block;
  width: 4.5rem;
  height: 4.5rem;
  border-radius: 10px;
  object-fit: cover;
}
.tp-caption {
  display: block;
  margin-top: 0.15rem;
  color: #6f6259;
  line-height: 1.2;
  overflow-wrap: anywhere;
}
.tp-full {
  position: fixed;
  inset: 0;
  z-index: 1060;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 1rem;
  background: rgba(43, 36, 32, 0.92);
}
.tp-close {
  position: absolute;
  top: 1rem;
  right: 1rem;
  width: 44px;
  height: 44px;
  padding: 0;
}
.tp-full__img {
  max-width: 100%;
  max-height: 80vh;
  border-radius: 10px;
  object-fit: contain;
}
.tp-full__caption {
  margin: 0;
  color: #fff;
  text-align: center;
  overflow-wrap: anywhere;
}
</style>
