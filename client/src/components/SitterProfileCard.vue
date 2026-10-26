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
            <div class="d-flex gap-2">
                <img :src="sitter.profilePicture?.url || defaultAvatar"
                    class="rounded-circle img-fluid"
                    style="width: 50px; height: 50px; object-fit: cover; border:1px solid grey"
                    alt="Circular Profile">
                <div class="d-flex flex-column ms-1 mb-3">
                    <div class="d-flex align-items-center gap-2">
                        <h5 class="card-title mb-0">{{ sitter.username }}</h5>
                        <span v-if="isNewSitter" class="badge rounded-pill text-bg-success">New sitter</span>
                    </div>
                    <ShowStarRating :modelValue="Math.floor(sitter.sitterProfile.ratingAvg)" :maxStars="5" class="mb-2"> ({{ sitter.sitterProfile.ratingCount }})</ShowStarRating>
                    <small v-if="sitter.distanceKm !== null" class="d-block text-secondary mb-1">
                        ~ {{ sitter.distanceKm.toFixed(1) }} km away
                    </small>
                </div>
            </div>
            
            <span v-for="pet in sitter.sitterProfile.petTypes" class="btn btn-warning me-3 mb-2 text-dark fw-medium">{{ pet }}</span>
            <p v-if="sitter.bio?.trim()" class="fw-medium">Bio: {{ sitter.bio }}</p>
            <p>${{sitter.sitterProfile.petsittingRates}}/day</p>
            <slot></slot>
        </div>
    </div>

</template>
