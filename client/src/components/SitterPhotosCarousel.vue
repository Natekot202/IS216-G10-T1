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
    transform: `translateX(${o * 52}%) scale(${1 - a * 0.14})`,
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

      <template v-if="count > 1">
        <button type="button" class="pcar__arrow pcar__arrow--prev" aria-label="Previous photo" @click="prev">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.2"
                  stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
        <button type="button" class="pcar__arrow pcar__arrow--next" aria-label="Next photo" @click="next">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.2"
                  stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      </template>
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
  --pcar-interval: 4s;
  --pcar-w: min(60%, 380px);        
  max-width: 720px;
  margin-inline: auto;
}
.pcar__stage {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  place-items: center;
  aspect-ratio: 16 / 7;               
  overflow: hidden;
}
.pcar__img {
  grid-area: 1 / 1;
  width: var(--pcar-w);
  aspect-ratio: 4 / 3;              
  height: auto;
  max-height: 100%;
  object-fit: cover;
  border-radius: 16px;
  user-select: none;
  transition: transform 0.6s ease, filter 0.6s ease, opacity 0.6s ease;
}
.pcar__arrow {
  position: absolute;
  top: 50%;
  z-index: 20;
  width: 2.6rem;
  height: 2.6rem;
  display: grid;
  place-items: center;
  border: 0;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.505);
  color: #2b2420;
  box-shadow: 0 4px 14px rgba(43, 36, 32, 0.28);
  cursor: pointer;
  transform: translateY(-50%);
  transition: background 0.2s, color 0.2s, transform 0.2s;
}
.pcar__arrow--prev {
  left: calc(50% - var(--pcar-w) / 2 - 1.35rem);
}
.pcar__arrow--next {
  right: calc(50% - var(--pcar-w) / 2 - 1.35rem);
}
.pcar__arrow:hover {
  background: #a85a38;
  color: #fff;
  transform: translateY(-50%) scale(1.06);
}
.pcar__arrow:focus-visible {
  outline: 2px solid #c44f1c;
  outline-offset: 2px;
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

@media (max-width: 575.98px) {
  .pcar {
    --pcar-w: 86%;
  }
  .pcar__stage {
    aspect-ratio: 4 / 3;
  }
  .pcar__arrow {
    width: 2.2rem;
    height: 2.2rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .pcar__img,
  .pcar__arrow,
  .pcar__bar {
    transition: none;
  }
  .pcar__fill {
    animation: none;                 
  }
}
</style>