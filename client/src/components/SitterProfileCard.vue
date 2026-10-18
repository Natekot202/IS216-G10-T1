<script setup>
import ShowStarRating from './ShowStarRating.vue';

const props = defineProps({sitter: Object})

</script>

<template>
    
    <div class="card">
        <div class="card-body">
            <div class="d-flex gap-2">
                <img src="../assets/img/tempProfile.jpg"
                    class="rounded-circle img-fluid"
                    style="width: 50px; height: 50px; object-fit: cover; border:1px solid grey"
                    alt="Circular Profile">
                <div class="d-flex flex-column ms-1 mb-3">
                    <h5 class="card-title">{{ sitter.username }}</h5>
                    <ShowStarRating :modelValue="Math.floor(sitter.sitterProfile.ratingAvg)" :maxStars="5"> ({{ sitter.sitterProfile.ratingCount }})</ShowStarRating>
                </div>
            </div>
            <small v-if="sitter.distanceKm !== null" class="d-block text-secondary mb-1">
                ~ {{ sitter.distanceKm.toFixed(1) }} km away
            </small>
            <span v-for="pet in sitter.sitterProfile.petTypes" class="btn btn-warning me-3 mb-2 text-dark fw-medium">{{ pet }}</span>
            <p class="fw-medium">Bio: {{ sitter.bio }}</p>
            <p>${{sitter.sitterProfile.petsittingRates}}/day</p>
            <slot></slot>
        </div>
    </div>

</template>