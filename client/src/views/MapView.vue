<script setup>
import WalkMap from '../components/WalkMap.vue'
import { useGeoTracker } from '../utils/useGeoTracker.js'

const {position, path, accuracy, tracking, error, start, stop } = useGeoTracker()
</script>

<template>
    <div class="d-flex flex-column vh-100">
        <div class="p-2 d-flex gap-2 align-items-center">
            <button class="btn btn-primary" v-if="!tracking" @click="start">Start Tracking</button>
            <button class="btn btn-danger" v-if="tracking" @click="stop">Stop Tracking</button>
            <small v-if="accuracy"> +- {{ Math.round(accuracy) }}m . {{ path.length }} points</small>
            <small v-if="error" class="text-danger"> {{ error }}</small>
        </div>
        <WalkMap class="flex-grow-1" :position="position" :walked-path="path" />
    </div>
</template>