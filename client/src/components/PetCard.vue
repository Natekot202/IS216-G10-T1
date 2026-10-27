<script setup>
import { computed } from 'vue'
import { formatAge } from '../utils/formatAge.js'

const props = defineProps({
  pet: { type: Object, required: true },
  editable: { type: Boolean, default: false },
  editing: { type: Boolean, default: false }
})

defineEmits(['edit','delete'])

const age = computed(() => (props.pet.ageMonths != null ? `${formatAge(props.pet.ageMonths)} old` : ''))

</script>

<template>
  <article class="pc" :class="{ 'pc--editing': editing }">
    <div class="pc__photo">
      <img v-if="pet.photo?.url" :src="pet.photo.url" :alt="`Photo of ${pet.name}`" loading="lazy" />
      <div v-else class="pc__fallback" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <ellipse cx="12" cy="16.5" rx="5.2" ry="4.2" fill="currentColor" />
          <circle cx="5.5" cy="11.5" r="2.1" fill="currentColor" />
          <circle cx="9.6" cy="6.8" r="2.3" fill="currentColor" />
          <circle cx="14.4" cy="6.8" r="2.3" fill="currentColor" />
          <circle cx="18.5" cy="11.5" r="2.1" fill="currentColor" />
        </svg>
      </div>

      <div v-if="editable" class="pc__actions">
        <button type="button" class="pc__icon" :aria-label="`Edit ${pet.name}`" @click="$emit('edit', pet)">
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"
                  fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
        <button type="button" class="pc__icon pc__icon--danger" :aria-label="`Remove ${pet.name}`"
                @click="$emit('delete', pet._id)">
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3"
                  fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      </div>
    </div>

    <div class="pc__body">
      <h5 class="pc__name">{{ pet.name }}</h5>

      <p class="pc__meta">
        <span class="pc__tag">{{ pet.species }}</span>
        <span v-if="pet.breed" class="pc__breed">{{ pet.breed }}</span>
      </p>

      <p v-if="age" class="pc__age">{{ age }}</p>
      <p v-if="pet.description" class="pc__desc" :title="pet.description">{{ pet.description }}</p>
    </div>
  </article>

</template>

<style scoped>
.pc {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  border: 1px solid rgba(196, 119, 86, 0.3);
  border-top: 4px solid #c47756;    
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 4px 12px rgba(120, 70, 40, 0.12);
}
.pc--editing {
  box-shadow: 0 0 0 2px #c44f1c, 0 4px 12px rgba(120, 70, 40, 0.12);
}

.pc__photo {
  position: relative;
  flex: none;
  aspect-ratio: 1 / 1;
  overflow: hidden;
  background: #f4e4d3;
}
.pc__photo img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 30%;
}
.pc__fallback {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  color: rgba(196, 119, 86, 0.55);
}
.pc__fallback svg {
  width: 34%;
  height: auto;
}

.pc__actions {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  display: flex;
  gap: 0.4rem;
}
.pc__icon {
  width: 2rem;
  height: 2rem;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.92);
  color: #5c524b;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
}
.pc__icon:hover {
  background: #fff;
  color: #a85a38;
}
.pc__icon--danger:hover {
  color: #b3261e;
}
.pc__icon:focus-visible {
  outline: 2px solid #c44f1c;
  outline-offset: 2px;
}

.pc__body {
  flex: 1;
  padding: 0.85rem 1rem 1rem;
}
.pc__name {
  margin: 0;
  font-size: 1.2rem;
  font-weight: 700;
  line-height: 1.2;
  color: #2b2420;
  overflow-wrap: anywhere;
}
.pc__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  margin: 0.5rem 0 0;
  font-size: 0.85rem;
}
.pc__tag {
  padding: 0.15rem 0.6rem;
  border-radius: 999px;
  background: #f4e4d3;
  color: #2b2420;
  font-weight: 600;
  text-transform: capitalize;
}
.pc__breed {
  color: #5c524b;
  text-transform: capitalize;
}
.pc__age {
  margin: 0.5rem 0 0;
  font-size: 0.85rem;
  color: #5c524b;
}
.pc__desc {
  display: -webkit-box;
  margin: 0.5rem 0 0;
  overflow: hidden;
  font-size: 0.9rem;
  color: #2b2420;
  overflow-wrap: anywhere;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
}
</style>