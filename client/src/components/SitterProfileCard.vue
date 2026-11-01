<script setup>
import { computed } from 'vue'
import ShowStarRating from './ShowStarRating.vue';
import defaultAvatar from '../assets/img/tempProfile.jpg'

const props = defineProps({sitter: Object})
const isNewSitter = computed(() => {
    const createdAt = new Date(props.sitter?.createdAt).getTime()
    const ageMs = Date.now() - createdAt
    return Number.isFinite(createdAt) && ageMs >= 0 && ageMs < 3 * 24 * 60 * 60 * 1000
})

</script>

<template>
    
    <div class="card">
        <div class="card-body">
            <div class="d-flex justify-content-start gap-2">
                <img :src="sitter.profilePicture?.url || defaultAvatar"
                    class="border rounded img-fluid"
                    style="width: 80px; height: 80px; object-fit: cover; border:1px solid grey"
                    alt="Circular Profile">
                <div class="d-flex flex-column ms-2 mb-3">
                    <div class="d-flex align-items-center gap-2">
                        <h5 class="card-title mb-0 fw-bolder">{{ sitter.username }}</h5>
                        <span v-if="isNewSitter" class="badge rounded-pill text-bg-success">New sitter</span>
                    </div>
                    <ShowStarRating :modelValue="Math.floor(sitter.sitterProfile.ratingAvg)" :maxStars="5" class="mb-2"> ({{ sitter.sitterProfile.ratingCount }})</ShowStarRating>
                    <small v-if="sitter.distanceKm !== null" class="d-block text-secondary mb-1">
                        ~ {{ sitter.distanceKm.toFixed(1) }} km away
                    </small>
                </div>
            </div>
            <p v-show="sitter.bio?.trim()" class="fw-medium mb-2">{{ sitter.bio }}</p>

            <div class="d-flex flex-wrap gap-2">
                <span v-for="pet in sitter.sitterProfile.petTypes" :key="pet" class="pet-tag">{{ pet }}</span>
            </div>
            <!-- Services offered (prices are fixed per task now, so no hourly rate here) -->
            <p v-if="sitter.sitterProfile.services?.length" class="small text-secondary mb-2">
                Offers: {{ sitter.sitterProfile.services.join(' · ') }}
            </p>
            <slot></slot>
        </div>
    </div>

</template>

<style scoped>
.card {
  margin-top: 1rem;
  border: 1px solid rgba(196, 119, 86, 0.3);
  border-top: 4px solid var(--line);    
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 6px 16px rgba(120, 70, 40, 0.1);
}
.pet-tag {
  padding: 0.15rem 0.7rem;
  border-radius: 10px;
  background: var(--accent, #a85a38);
  color: #fff;
  font-size: 0.85rem;
  font-weight: 600;
  line-height: 1.5;
  margin-bottom:0.5rem;
}
</style>
