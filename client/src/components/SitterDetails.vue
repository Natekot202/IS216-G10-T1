<script setup>
import { computed, ref, watch } from 'vue'
import { usersApi } from '../services/api.js'
import { formatAge } from '../utils/formatAge.js'
import PhotoCarousel from './SitterPhotosCarousel.vue'


const props = defineProps({
  profile: { type: Object, required: true },
  editable: { type: Boolean, default: false }
})

const sp = computed(() => props.profile.sitterProfile || {})
const gallery = computed(() => sp.value.gallery ?? [])
const rateAmount = computed(() => (sp.value.petsittingRates > 0 ? `S$${sp.value.petsittingRates}` : ''))

const experience = computed(() => {
  if (!sp.value.experienceStart) {
    return 'Not set'
  }
  const start = new Date(sp.value.experienceStart)
  const now = new Date()
  const months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
  return formatAge(Math.max(0, months))
})

const hasExperience = computed(() => !!sp.value.experienceStart)
const hasArea = computed(() => !!sp.value.serviceArea?.label)
const area = computed(() => sp.value.serviceArea?.label || '')
const ratingAvg = computed(() => sp.value.ratingAvg || 0)
const ratingCount = computed(() => sp.value.ratingCount || 0)

function stars(n) {
  const full = Math.round(n)
  return '★'.repeat(full) + '☆'.repeat(5 - full)
}

const hasDetails = computed(() => 
  sp.value.petsittingRates > 0 || sp.value.petTypes?.length || sp.value.services?.length
)

const reviews = ref([])
const loadingReviews = ref(true)
const reviewError = ref('')

async function loadReviews() {
  if (!props.profile._id){
    loadingReviews.value = true
  }
  reviewError.value = ''
  try {
    reviews.value = await usersApi.getReviews(props.profile._id)
  } catch (err) {
    reviewError.value = err.response?.data?.message || 'Could not load reviews.'
  } finally {
    loadingReviews.value = false
  }
}

watch(() => props.profile._id, loadReviews, { immediate: true })

function formatDate(d) {
  if (!d) {
    return ''
  }
  const date = new Date(d)
  if (Number.isNaN(date.getTime())) {
    return ''
  }
  return new Date(d).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })
}
</script>

<template>
  <div class="sd">
    <div v-if="editable && !hasDetails" class="sd-nudge">
      <p class="mb-2">Owners can’t find you yet. Add your rate, experience and the pets you look after.</p>
      <router-link to="/editProfile" class="btn btn-sm text-white" style="background-color:#a85a38;">
        Add your details
      </router-link>
    </div>

    <div class="sd-band">
      <div class="sd-stat">
        <template v-if="ratingCount">
          <span class="sd-big">{{ ratingAvg.toFixed(1) }}</span>
          <span class="sd-stars" :aria-label="`Rated ${ratingAvg.toFixed(1)} out of 5`">{{ stars(ratingAvg) }}</span>
          <span class="sd-sub">from {{ ratingCount }} {{ ratingCount === 1 ? 'rating' : 'ratings' }}</span>
        </template>
        <template v-else>
          <span class="sd-big">New</span>
          <span class="sd-sub">no ratings yet</span>
        </template>
      </div>

      <div class="sd-stat">
        <span class="sd-big" :class="{ 'sd-big--empty': !rateAmount }">{{ rateAmount || '—' }}</span>
        <span class="sd-sub">{{ rateAmount ? 'per hour' : 'rate not set' }}</span>
      </div>

      <div class="sd-stat">
        <span class="sd-big" :class="{ 'sd-big--empty': !hasExperience }">{{ hasExperience ? experience : '—' }}</span>
        <span class="sd-sub">{{ hasExperience ? 'of experience' : 'experience not set' }}</span>
      </div>
    </div>

    <p class="sd-area">
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z"
              fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" />
        <circle cx="12" cy="10" r="2.3" fill="currentColor" />
      </svg>
      <span v-if="hasArea" style="font-size:1.2rem;">Service Area: <strong>{{ area }}</strong></span>
      <span v-else class="text-muted" style="font-size:1.2rem;">Service area not set</span>
    </p>

    <section class="sd-group">
      <h4 class="sd-heading">Looks after</h4>
      <ul v-if="sp.petTypes?.length" class="sd-pills">
        <li v-for="t in sp.petTypes" :key="t">{{ t }}</li>
      </ul>
      <p v-else class="text-muted mb-0">None listed yet</p>
    </section>

    <section class="sd-group">
      <h4 class="sd-heading">Services</h4>
      <ul v-if="sp.services?.length" class="sd-pills">
        <li v-for="s in sp.services" :key="s">{{ s }}</li>
      </ul>
      <p v-else class="text-muted mb-0">None listed yet</p>
    </section>

    <PhotoCarousel v-if="gallery.length" :photos="gallery" :name="profile.username" class="mb-4" />

    <div v-else-if="editable" class="sd-nudge">
      <p class="mb-2">Add photos of yourself so owners know who is coming to their home.</p>
      <router-link to="/editProfile" class="btn btn-sm text-white" style="background-color:#a85a38;">
        Add photos
      </router-link>
    </div>   
  </div>
</template>

<style scoped>
.sd-nudge {
  margin-bottom: 1.25rem;
  padding: 1rem 1.15rem;
  border: 1px dashed #c47756;
  border-radius: 12px;
  background: rgba(196, 119, 86, 0.08);
  color: #2b2420;
}

.sd-band {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  border: 1px solid rgba(196, 119, 86, 0.3);
  border-top: 4px solid #c47756;           
  border-radius: 20px;
  background: #f6e3d6;                   
  box-shadow: 0 8px 20px rgba(120, 70, 40, 0.14);
  max-width:900px;
}
.sd-stat {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  min-width: 0;
  padding: 1.1rem 1.25rem;
  font-size: 18px;
}
.sd-stat + .sd-stat {
  border-left: 1px solid rgba(255, 255, 255, 0.14);
}
.sd-big {
  color: black;
  font-weight:700;
}
.sd-big--empty {
  color: black;
}
.sd-stars {
  color: #e3946f;
}
.sd-sub {
  color: black;
}

@media (max-width: 575.98px) {
  .sd-band {
    grid-template-columns: 1fr;
  }
  .sd-stat + .sd-stat {
    border-left: 0;
    border-top: 1px solid rgba(255, 255, 255, 0.14);
  }
}

.sd-area {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin: 1rem 0 0;
  color: #2b2420;
}
.sd-area svg {
  flex: 0 0 auto;
  color: #c44f1c;
}

.sd-group {
  margin-top: 1.5rem;
  margin-bottom: 1.5rem;
}
.sd-heading {
  margin: 0 0 0.6rem;
  font-size: 1.2rem;
  font-weight: 700;
  color: #2b2420;
}
.sd-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.sd-pills li {
  padding: 0.3rem 0.8rem;
  border: 1px solid #e6d3c0;
  border-radius: 100px;
  background: #fff;
  color: #2b2420;
  font-size: 0.9rem;
  font-weight: 600;
}
</style>