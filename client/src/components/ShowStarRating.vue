<!-- displays rating only -->

<script setup>

const props = defineProps({
  modelValue: {
    type: Number,
    default: 0
  },
  maxStars: {
    type: Number,
    default: 5
  }
});

</script>

<template>
  <div class="star-rating">
    <button
      v-for="star in maxStars"
      :key="star"
      type="button"
      class="star-button"
    >
      <!-- inline SVG for the star icon -->
      <svg
        xmlns="http://w3.org"
        viewBox="0 0 24 24"
        :class="['star-icon', { 'is-filled': star <= (hoverRating || modelValue) }]"
      >
        <path d="M12 .587l3.668 7.431 8.2 1.192-5.934 5.787 1.4 8.168L12 18.896l-7.334 3.857 1.4-8.168L.132 9.21l8.2-1.192L12 .587z"/>
      </svg>
    </button>
    <slot></slot>
  </div>
</template>



<style scoped>
.star-rating {
  display: flex;
  gap: 4px;
}

.star-button {
  background: none;
  border: none;
  padding: 0;
  outline: none;
}

/* Color for empty stars */
.star-icon {
  width: 20px;
  height: 20px;
  fill: #d8d8d8; 
  transition: fill 0.2s ease, transform 0.1s ease;
}


/* Color for filled stars (prioritizing hover states) */
.star-icon.is-filled {
  fill: #ffd055; 
}
</style>