<script setup>
import { computed } from 'vue'
import { currentUser } from '../services/auth.js'

const steps = computed(() => {
  const u = currentUser.value
  const sp = u?.sitterProfile || {}
  return [
    { key: 'area', text: 'Add your address and service area', ok: !!sp.serviceArea?.label },
    { key: 'pets', text: 'Choose the pets you look after', ok: !!sp.petTypes?.length },
    { key: 'services', text: 'Choose the services you offer', ok: !!sp.services?.length }
  ]
})

const doneCount = computed(() => steps.value.filter((s) => s.ok).length)
const show = computed(
  () => currentUser.value?.role === 'sitter' && steps.value.some((s) => !s.ok)
)
</script>

<template>
  <section v-if="show" class="pc" aria-labelledby="pc-title">
    <div class="pc-head">
      <div>
        <h3 id="pc-title" class="pc-title">Finish your profile to start getting bookings</h3>
        <p class="pc-sub">Owners can only find you once these steps are complete.</p>
      </div>
      <span class="pc-count">{{ doneCount }} of {{ steps.length }}</span>
    </div>

    <div class="pc-progress" role="progressbar" aria-label="Profile progress"
         aria-valuemin="0" :aria-valuemax="steps.length" :aria-valuenow="doneCount">
      <span :style="{ width: `${(doneCount / steps.length) * 100}%` }"></span>
    </div>

    <ul class="pc-steps">
      <li v-for="s in steps" :key="s.key" :class="{ 'pc-steps__ok': s.ok }">
        <span class="pc-tick" aria-hidden="true">{{ s.ok ? '✓' : '' }}</span>
        <span>{{ s.text }}</span>
      </li>
    </ul>

    <router-link to="/editProfile" class="pc-btn">Complete my profile</router-link>
  </section>
</template>

<style scoped>
.pc {
  margin-bottom: 1.25rem;
  padding: 1.15rem 1.3rem;
  border: 1px solid rgba(196, 119, 86, 0.3);
  border-top: 4px solid #c47756;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 6px 16px rgba(120, 70, 40, 0.1);
}
.pc-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem 1rem;
}
.pc-title {
  margin: 0 0 0.2rem;
  font-size: 1.25rem;
  font-weight: 700;
  color: #2b2420;
}
.pc-sub {
  margin: 0;
  font-size: 0.9rem;
  color: #5c524b;
}
.pc-count {
  font-size: 0.9rem;
  font-weight: 700;
  color: #a85a38;
}
.pc-progress {
  height: 0.45rem;
  margin: 0.9rem 0;
  overflow: hidden;
  border-radius: 999px;
  background: #efe3d6;
}
.pc-progress span {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: #c47756;
  transition: width 0.4s ease;
}
.pc-steps {
  display: grid;
  gap: 0.5rem;
  margin: 0 0 1.1rem;
  padding: 0;
  list-style: none;
}
.pc-steps li {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  color: #2b2420;
}
.pc-tick {
  flex: none;
  width: 1.4rem;
  height: 1.4rem;
  display: grid;
  place-items: center;
  border: 2px solid #c9a98f;
  border-radius: 50%;
  font-size: 0.8rem;
  font-weight: 700;
  color: #fff;
}
.pc-steps__ok .pc-tick {
  border-color: #4f8a3a;
  background: #4f8a3a;
}
.pc-steps__ok > span:nth-child(2) {
  color: #5c524b;
  text-decoration: line-through;
}
.pc-opt {
  font-size: 0.75rem;
  color: #5c524b;
}
.pc-btn {
  display: inline-block;
  padding: 0.4rem 1.1rem;
  border-radius: 10px;
  background: #a85a38;
  color: #fff;
  font-weight: 700;
  text-decoration: none;
}
.pc-btn:hover {
  background: #8f4a2c;
  color: #fff;
}
.pc-btn:focus-visible {
  outline: 2px solid #c44f1c;
  outline-offset: 2px;
}

@media (max-width: 575.98px) {
  .pc-btn {
    display: block;
    text-align: center;
  }
}

@media (prefers-reduced-motion: reduce) {
  .pc-progress span {
    transition: none;
  }
}
</style>