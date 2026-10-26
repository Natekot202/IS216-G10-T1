<script setup>
import { computed, ref, watch } from 'vue'

const props = defineProps({
  photos: { type: Array, required: true },     
  name: { type: String, default: '' }
})

const current = ref(0)
const restart = ref(0)
const hovered = ref(false)
const focused = ref(false)
const isPaused = computed(() => hovered.value || focused.value)
const count = computed(() => props.photos.length)

watch(count, (n) => {
  if (current.value >= n) {
    current.value = 0
  }
})

function go(i) {
  current.value = (i + count.value) % count.value
  restart.value++
}
const next = () => go(current.value + 1)
const prev = () => go(current.value - 1)

function pick(i) {
  if (i !== current.value) {
    go(i)
  }
}

function offsetOf(i) {
  const n = count.value
  const half = Math.floor(n / 2)
  return ((i - current.value + n + half) % n) - half
}

function styleFor(i) {
  const o = offsetOf(i)
  const a = Math.abs(o)
  return {
    transform: `translateX(${o * 46}%) scale(${1 - a * 0.16})`,
    filter: a === 0 ? 'none' : `blur(${a * 2 + 1}px) brightness(0.92)`,
    opacity: a > 2 ? 0 : 1 - a * 0.22,
    zIndex: 10 - a
  }
}

function onFocusIn(e) {
  focused.value = e.target.matches(':focus-visible')
}

let touchStartX = 0
function onTouchStart(e) {
  touchStartX = e.changedTouches[0].clientX
}
function onTouchEnd(e) {
  const dx = e.changedTouches[0].clientX - touchStartX
  if (Math.abs(dx) > 40) {
    if (dx < 0) {
      next()
    } else {
      prev()
    }
  }
}
</script>

<template>
  <section v-if="count" class="pcar" role="region" aria-roledescription="carousel"
           :aria-label="name ? `Photos of ${name}` : 'Photos'"
           @mouseenter="hovered = true" @mouseleave="hovered = false"
           @focusin="onFocusIn" @focusout="focused = false"
           @keydown.left="prev" @keydown.right="next"
           @touchstart.passive="onTouchStart" @touchend="onTouchEnd">

    <div class="pcar__stage">
      <img v-for="(p, i) in photos" :key="p._id" :src="p.url"
           :alt="i === current ? `Photo ${i + 1} of ${count}${name ? ` of ${name}` : ''}` : ''"
           class="pcar__img" :class="{ 'pcar__img--active': i === current }"
           :style="styleFor(i)" :aria-hidden="i !== current" draggable="false" @click="pick(i)" />
    </div>

    <div v-if="count > 1" class="pcar__dots">
      <button v-for="(p, i) in photos" :key="p._id" type="button" class="pcar__dot"
              :aria-label="`Show photo ${i + 1}`" :aria-current="i === current" @click="go(i)">
        <span class="pcar__bar" :class="{ 'pcar__bar--active': i === current }">
          <span v-if="i === current" :key="restart" class="pcar__fill"
                :style="{ animationPlayState: isPaused ? 'paused' : 'running' }" @animationend="next"></span>
        </span>
      </button>
    </div>
  </section>
</template>

<style scoped>
.pcar {
  --pcar-interval: 10s;
  width: 100%;
  max-width: 760px;          
  margin-inline: auto;
}

.pcar__stage {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr);     
  place-items: center;
  height: clamp(220px, 32vw, 320px);
  padding-block: 0.5rem;
  overflow: hidden;
  justify-items: center;
  align-items: center; 
}
.pcar__img {
  grid-area: 1 / 1;
  height: 100%;
  max-width: 100%;
  aspect-ratio: 4 / 3;
  object-fit: cover;
  border-radius: 10px;
  user-select: none;
  transition: transform 0.6s ease, filter 0.6s ease, opacity 0.6s ease;
  border: 1px solid #c44f1c;
  justify-self: center;   

}
.pcar__img:not(.pcar__img--active) {
  cursor: pointer;
}
.pcar__dots {
  display: flex;
  justify-content: center;
  margin-top: 0.4rem;
}
.pcar__dot {
  padding: 0.6rem 0.2rem;
  border: 0;
  background: none;
  cursor: pointer;
}
.pcar__bar {
  position: relative;
  display: block;
  width: 0.55rem;
  height: 0.55rem;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(43, 36, 32, 0.2);
  transition: width 0.3s ease;
}
.pcar__bar--active {
  width: 2.1rem;
}
.pcar__fill {
  position: absolute;
  inset: 0;
  background: #c47756;
  transform-origin: left;
  animation: pcar-fill var(--pcar-interval) linear forwards;
}
.pcar__dot:focus-visible {
  outline: 2px solid #c44f1c;
  outline-offset: 2px;
}
@keyframes pcar-fill {
  from {
    transform: scaleX(0);
  }
  to {
    transform: scaleX(1);
  }
}

@media (prefers-reduced-motion: reduce) {
  .pcar__img {
    transition: none;
  }
  .pcar__fill {
    animation: none;             
  }
}
</style>