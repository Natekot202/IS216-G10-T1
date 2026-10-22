<script setup>
const props = defineProps({'locationSuggestions':Array, label: {type:String, default: 'Location'}})
const emits = defineEmits(['enterLocation', 'selectLocation'])
const locationQueryModel = defineModel('locationQuery')


</script>
<template>
    <label for="locations" v-if='label' class="form-label fw-medium">Locations</label>
    <div class="position-relative mb-3">
        <input type="text" placeholder="Select location" class="form-control" id="locations"
            v-model="locationQueryModel"
            @input="$emit('enterLocation')"
            @keydown.enter.prevent="locationSuggestions[0] && $emit('selectLocation', locationSuggestions[0])"
            autocomplete="off">
        <ul v-if="locationSuggestions.length" class="list-group position-absolute w-100 shadow" style="z-index:1000">
        <li v-for="s in locationSuggestions" :key="s.label"
            class="list-group-item list-group-item-action"
            style="cursor:pointer"
            @click="$emit('selectLocation', s)">{{ s.label }}</li>
        </ul>
    </div>

</template>