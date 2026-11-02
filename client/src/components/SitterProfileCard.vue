<script setup>
import { computed } from 'vue'
import ShowStarRating from './ShowStarRating.vue';
import defaultAvatar from '../assets/img/tempProfile.jpg'

const props = defineProps({
    sitter: Object,
    reasons: { type: Array, default: () => [] } // why this sitter is recommended, e.g. ['Takes Dog, Cat', 'Offers Grooming'] (only with "Recommended for me" on)
})
const isNewSitter = computed(() => {
    const createdAt = new Date(props.sitter?.createdAt).getTime()
    const ageMs = Date.now() - createdAt
    return Number.isFinite(createdAt) && ageMs >= 0 && ageMs < 3 * 24 * 60 * 60 * 1000
})

</script>

<template>
    
    <div class="card">
        <div class="card-body d-flex flex-column">
            <!-- flex-wrap: on very narrow cards the name and stars go under the photo -->
            <div class="d-flex flex-wrap justify-content-start gap-2">
                <img :src="sitter.profilePicture?.url || defaultAvatar"
                    class="border rounded img-fluid flex-shrink-0"
                    style="width: 80px; height: 80px; object-fit: cover; border:1px solid grey"
                    alt="Circular Profile">
                <!-- card-info can shrink, so on narrow phones the badge and stars stay inside the card -->
                <div class="d-flex flex-column ms-2 mb-3 card-info">
                    <div class="d-flex flex-wrap align-items-center gap-1 column-gap-2">
                        <h5 class="card-title mb-0 fw-bolder text-break">{{ sitter.username }}</h5>
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
            <!-- "Recommended for me" is on: the reasons this sitter was picked, as small green tags -->
            <div v-if="reasons.length" class="d-flex flex-wrap gap-2 mb-1">
                <span v-for="r in reasons" :key="r" class="reason-tag">✓ {{ r }}</span>
            </div>
            <!-- pushed to the bottom so the buttons line up when cards are the same height -->
            <div class="mt-auto">
                <slot></slot>
            </div>
        </div>
    </div>

</template>

<style scoped>
.card {
  height: 100%;
  border: 1px solid rgba(196, 119, 86, 0.3);
  border-top: 4px solid var(--line);    
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 6px 16px rgba(120, 70, 40, 0.1);
}
.card-info {
  min-width: 0; /* a flex item won't shrink below its content without this */
}
/* the stars and "(3)" wrap onto a second line instead of running out of the card */
.card-info :deep(.star-rating) {
  flex-wrap: wrap;
  align-items: center;
}
.reason-tag {
  padding: 0.15rem 0.6rem;
  border-radius: 999px;
  background: #e6f5ee;
  border: 1px solid #9fd8c0;
  color: #1f7a53;
  font-size: 0.8rem;
  font-weight: 600;
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
