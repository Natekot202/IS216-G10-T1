<script setup>
import { currentUser } from "../services/auth.js";
import { computed, onMounted, ref, watch } from 'vue';
import L from 'leaflet';
import axios from 'axios';
import SitterProfileCard from '../components/SitterProfileCard.vue'
import StarRating from '../components/StarRating.vue'
import Map from '../components/Map.vue'
import LocationQuery from "../components/LocationQuery.vue";

const URL = 'http://localhost:5000'
const profilePic = computed(() => currentUser.value?.profilePicture?.url || "")
const sitterProfiles = ref([])
const errorMsg = ref("")
const selectedPets = ref([])
const otherPets = ref("")

//rangebar values
const minLimit = ref(0)
const maxLimit = ref(200)
const minValue = ref(0)
const maxValue = ref(200)

//search rating
const userRating = ref(0) //initial rating value

//search name
const searchKey = ref("")
const availableFrom = ref("")
const draftFrom = ref("")

// search date
const availableTo = ref("")
const draftTo = ref("")
const showDatePicker = ref(false)
const calendarMonth = ref(new Date(new Date().getFullYear(), new Date().getMonth(), 1))
const sitterAvailability = ref({})
let availabilityRequestId = 0

//create date keys in calandar popup
function dateKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const todayKey = dateKey(new Date())
const calendarTitle = computed(() => calendarMonth.value.toLocaleDateString('en-SG', { month: 'long', year: 'numeric' }))
const calendarWeeks = computed(() => {
  const year = calendarMonth.value.getFullYear()
  const month = calendarMonth.value.getMonth()
  const days = []
  const offset = new Date(year, month, 1).getDay()
  for (let i = 0; i < offset; i++) days.push(null)
  for (let day = 1; day <= new Date(year, month + 1, 0).getDate(); day++) {
    const date = new Date(year, month, day)
    days.push({ key: dateKey(date), day })
  }
  while (days.length % 7) days.push(null)
  return Array.from({ length: days.length / 7 }, (_, i) => days.slice(i * 7, i * 7 + 7))
})
const dateRangeLabel = computed(() => {
  if (!availableFrom.value) return 'Select dates'
  const format = (date) => new Date(`${date}T00:00:00`).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })
  return availableTo.value ? `${format(availableFrom.value)} – ${format(availableTo.value)}` : `${format(availableFrom.value)} – choose end date`
})

function changeCalendarMonth(offset) {
  calendarMonth.value = new Date(calendarMonth.value.getFullYear(), calendarMonth.value.getMonth() + offset, 1)
}

function pickAvailabilityDate(date) {
  if (!date || date < todayKey) return
  if (!draftFrom.value || draftTo.value || date < draftFrom.value) {
    draftFrom.value = date
    draftTo.value = ""
    return
  }
  draftTo.value = date
}

function isInSelectedRange(date) {
  return Boolean(date && draftFrom.value && draftTo.value && date >= draftFrom.value && date <= draftTo.value)
}

function confirmAvailabilityDates() {
  if (!draftFrom.value || !draftTo.value) return
  availableFrom.value = draftFrom.value
  availableTo.value = draftTo.value
  showDatePicker.value = false
}

function toggleDatePicker() {
  if (!showDatePicker.value) {
    draftFrom.value = availableFrom.value
    draftTo.value = availableTo.value
  }
  showDatePicker.value = !showDatePicker.value
}

const requestedDates = computed(() => {
  if (!availableFrom.value || !availableTo.value || availableTo.value < availableFrom.value) return []
  const dates = []
  const day = new Date(`${availableFrom.value}T00:00:00`)
  const end = new Date(`${availableTo.value}T00:00:00`)
  while (day <= end) {
    dates.push(`${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`)
    day.setDate(day.getDate() + 1)
  }
  return dates
})

watch([availableFrom, availableTo, sitterProfiles], async () => {
  const requestId = ++availabilityRequestId
  sitterAvailability.value = {}
  if (!requestedDates.value.length || !sitterProfiles.value.length) return

  const entries = await Promise.all(sitterProfiles.value.map(async (sitter) => {
    try {
      const response = await axios.get(`${URL}/api/availability/${sitter._id}`)
      return [sitter._id, Object.fromEntries(response.data.map(({ date, status }) => [date, status]))]
    } catch (error) {
      console.warn(`Could not load availability for sitter ${sitter._id}`, error)
      return [sitter._id, {}]
    }
  }))
  if (requestId === availabilityRequestId) sitterAvailability.value = Object.fromEntries(entries)
})

function filterByPets(list) {
  const targetPets = [...selectedPets.value].map((p) => p.toLowerCase().trim());
  const other = otherPets.value.toLowerCase().trim();
  if (other !== "") targetPets.push(other);
  if (targetPets.length === 0) return list;

  return list.filter((sitter) => {
    const sitterPets = (sitter.sitterProfile.petTypes ?? []).map((p) =>
      p.toLowerCase().trim()
    );
    return targetPets.every((pet) => sitterPets.includes(pet));
  });
}

function filterByRating(list) {
  if (userRating.value == 0) return list;
  return list.filter((sitter) => sitter.sitterProfile.ratingAvg == userRating.value);
}

function filterByPrice(list) {
  const min =  Number(minValue.value);
  const max =  Number(maxValue.value);
  return list.filter((s) => s.sitterProfile.petsittingRates >= min && s.sitterProfile.petsittingRates <= max);
}

function filterBySearch(list) {
  const key = searchKey.value.trim().toLowerCase();
  if (key === "") return list;
  return list.filter((sitter) => sitter.username.toLowerCase().includes(key));
}

const searchResults = computed(() => {
  let results = sittersWithDistance.value
  results = filterByPets(results);
  results = filterByRating(results);
  results = filterByPrice(results);
  results = filterBySearch(results);
  if (requestedDates.value.length) {
    results = results.filter((sitter) => {
      const availability = sitterAvailability.value[sitter._id]
      return availability && requestedDates.value.every((date) => availability[date] === 'available')
    })
  }
  results = filterByDistance(results)
  return sortByDistance(results)
});

function clearFilters(){
  selectedPets.value=[]
  otherPets.value=""
  minValue.value=0
  maxValue.value=100
  userRating.value=0
  locationQuery.value=""
  origin.value = null
  maxDistanceKm.value = maxDistanceLimit
  availableFrom.value = ""
  availableTo.value = ""
  draftFrom.value = ""
  draftTo.value = ""
}

function clearAvailabilityDates() {
  availableFrom.value = ""
  availableTo.value = ""
  draftFrom.value = ""
  draftTo.value = ""
}

async function loadSitterProfiles(){
  try {
    const response = await axios.get(`${URL}/api/sitters`)
    console.log(response.data)
    sitterProfiles.value = response.data
  } catch (error) {
    console.log(error)
    errorMsg.value = "Error loading data"
  }
}

// ensures that min < max for range bar
const validateMax = () => {
  if (maxValue.value < minValue.value) {
    maxValue.value = minValue.value
  }
}
const validateMin = () => {
  if (minValue.value > maxValue.value) {
    minValue.value = maxValue.value
  }
}

// styling for progress bar
const trackStyle = computed(() => {
  const range = maxLimit.value - minLimit.value
  const minPercent = ((minValue.value - minLimit.value) / range) * 100
  const maxPercent = ((maxValue.value - minLimit.value) / range) * 100
  
  return {
    background: `linear-gradient(to right, #ddd ${minPercent}%, #42b983 ${minPercent}%, #42b983 ${maxPercent}%, #ddd ${maxPercent}%)`
  }
})


// handles location queries
const locationQuery = ref("") // location field typed by user
const locationSuggestions = ref([]) // location suggestion dropdown
const origin = ref(null) // location selected when pressed eg. { lat, lng, label } 
let debounceTimer = null
let requestId = 0

// fetch location suggestions from sg 'onemap' api 
async function fetchLocationSuggestions(q) {
  const id = ++requestId
  try {
    const res = await axios.get('https://www.onemap.gov.sg/api/common/elastic/search', {
      params: { searchVal: q, returnGeom: 'Y', getAddrDetails: 'Y', pageNum: 1 }
    })
    if (id !== requestId) return // a newer request superseded this one
    locationSuggestions.value = (res.data.results ?? []).slice(0, 6).map(r => ({
      label: r.ADDRESS,
      lat: parseFloat(r.LATITUDE),
      lng: parseFloat(r.LONGITUDE)
    }))
  } catch (e) {
    console.warn('Location search failed', e)
    locationSuggestions.value = []
  }
}

// handles location field input
function onLocationInput() {
  clearTimeout(debounceTimer)
  const q = locationQuery.value.trim()
  if (q === "") {            // clearing the field removes the pin
    origin.value = null
    locationSuggestions.value = []
    return
  }
  if (q.length < 3) return
  //rate limiting
  debounceTimer = setTimeout(() => fetchLocationSuggestions(q), 400)
}

// location selector
function selectLocation(s) {
  origin.value = { lat: s.lat, lng: s.lng, label: s.label }
  locationQuery.value = s.label
  //clear fields
  locationSuggestions.value = []
}


// handles filter by location
const userLocation = ref(null)   // { lat, lng } from GPS
const maxDistanceLimit = 30
const maxDistanceKm = ref(maxDistanceLimit)   // at the limit = "any distance"

// get current location
function locateUser() {
  if (!navigator.geolocation) return
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => { userLocation.value = { lat: coords.latitude, lng: coords.longitude } },
    err => console.warn('Geolocation failed:', err.message)
  )
}

// starting point where distance is calculated
const referencePoint = computed(() => origin.value ?? userLocation.value) //starting point chosen depending on whether input field for location filled

const sittersWithDistance = computed(() => {
  //starting point
  const from = referencePoint.value
  // create a distance attribute for each sitter object
  return sitterProfiles.value.map(s => {
    let distanceKm = null
    // sitter coordinates 
    const c = s.sitterProfile?.serviceArea?.location?.coordinates
    if (from && Array.isArray(c) && c.length >= 2) {
      const lng = Number(c[0]), lat = Number(c[1])   // GeoJSON order (mongodb)
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        //calculate distance based on lat and lng using leaflet latlng
        distanceKm = L.latLng(from.lat, from.lng).distanceTo([lat, lng]) / 1000
      }
    }
    return { ...s, distanceKm }
  })
})

// filter function for distance
function filterByDistance(list) {
  if (!referencePoint.value || maxDistanceKm.value >= maxDistanceLimit) return list
  return list.filter(s => s.distanceKm !== null && s.distanceKm <= maxDistanceKm.value)
}

function sortByDistance(list) {
  if (!referencePoint.value) return list
  return [...list].sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity))
}

onMounted(()=>{
  loadSitterProfiles()
  locateUser()
})
</script>

<template>
    <div class="container-fluid">
      <!-- heading -->
      <div class="d-flex justify-content-start mb-3">
        <div>
          <h1 v-if="currentUser" class="fs-4 fw-bold">Welcome back, {{ currentUser.username }}🐾</h1>
          <h1 v-else class="fs-4 fw-bold">Welcome to Pet Society🐾</h1>
          <p class="fs-6">
            A community platform for you to find a trusted sitter!
          </p>
        </div>
        <router-link to="/profile" v-if="currentUser">
          <img v-if="profilePic" :src="profilePic"
            class="rounded-circle ms-auto"
            style="width: 50px; height: 50px; object-fit: cover; border:1px solid #c44f1c"
            alt="Circular Profile">
        </router-link>
      </div>
      <!-- main body -->
      <div class="row gx-3">
        <!-- filters  -->
        <div class="col-lg-4 order-lg-last order-first">
          <!-- map  -->
          <Map :profiles="searchResults" :origin="origin" :userLocation="userLocation"></Map>
          <div class="border p-3 shadow" style="border-radius: 10px; background-color: white;">
            <p class="text-secondary">Filters</p>
            <!-- location filter  -->
            <locationQuery 
              v-model:location-query="locationQuery" 
              :location-suggestions="locationSuggestions" 
              @enterLocation="onLocationInput"
              @selectLocation="selectLocation">
            </locationQuery>
            <!-- distance filter -->
            <label for="distance" class="form-label fw-medium">Distance</label>
            <input id="distance" type="range" class="form-range" min="1" :max="maxDistanceLimit" step="1"
                  v-model.number="maxDistanceKm" :disabled="!referencePoint">
            <small class="text-secondary d-block mb-3">
              <template v-if="!referencePoint">Allow location access or search a location to use this filter</template>
              <template v-else>
                {{ maxDistanceKm >= maxDistanceLimit ? 'Any distance' : `Within ${maxDistanceKm} km` }}
                of {{ origin ? origin.label : 'your location' }}
              </template>
            </small>
            <!-- availability date filter -->
            <label class="form-label fw-medium">Available dates</label>
            <div class="position-relative mb-1">
              <button type="button" class="form-control text-start d-flex justify-content-between align-items-center" aria-haspopup="dialog" :aria-expanded="showDatePicker" @click="toggleDatePicker">
                <span>{{ dateRangeLabel }}</span><span aria-hidden="true">▦</span>
              </button>
              <!-- show date calandar to pick date  -->
              <div v-if="showDatePicker" class="availability-picker shadow bg-white border rounded p-3" role="dialog" aria-label="Choose available date range">
                <div class="d-flex justify-content-between align-items-center mb-2">
                  <button type="button" class="btn btn-sm btn-outline-secondary" aria-label="Previous month" @click="changeCalendarMonth(-1)">‹</button>
                  <strong>{{ calendarTitle }}</strong>
                  <button type="button" class="btn btn-sm btn-outline-secondary" aria-label="Next month" @click="changeCalendarMonth(1)">›</button>
                </div>
                <div class="availability-calendar">
                  <span v-for="weekday in ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']" :key="weekday" class="weekday">{{ weekday }}</span>
                  <template v-for="(week, weekIndex) in calendarWeeks" :key="weekIndex">
                    <span v-for="(date, dayIndex) in week" :key="date?.key || `blank-${weekIndex}-${dayIndex}`" class="day-cell"
                    :class="{
                      'range-cell': isInSelectedRange(date?.key),
                      'range-start': date && draftFrom && draftTo && draftFrom !== draftTo && date.key === draftFrom,
                      'range-end': date && draftFrom && draftTo && draftFrom !== draftTo && date.key === draftTo
                    }">
                      <button v-if="date" type="button" class="calendar-day" :class="{ endpoint: date.key === draftFrom || date.key === draftTo }" :disabled="date.key < todayKey" @click="pickAvailabilityDate(date.key)">{{ date.day }}</button>
                    </span>
                  </template>
                </div>
                <div class="d-flex justify-content-between align-items-center mt-3">
                  <button type="button" class="btn btn-outline-secondary btn-sm" @click="clearAvailabilityDates">Clear days</button>
        
                  <button type="button" class="btn btn-primary btn-sm apply-days" :disabled="!draftFrom || !draftTo" @click="confirmAvailabilityDates">Confirm dates</button>
                </div>
              </div>
            </div>
            <small class="text-secondary d-block mb-3">Choose a consecutive date range. Sitters must be marked available on every selected day.</small>
            <!-- price filter  -->
            <label for="price" class="form-label fw-medium">Price</label>
            <div class="col-12">
              <div class="range-slider-container">
                <!-- Visual track background -->
                <div class="slider-track" :style="trackStyle"></div>
                  <input
                    type="range"
                    :min="minLimit"
                    :max="maxLimit"
                    step="5"
                    v-model.number="minValue"
                    @input="validateMin"
                    class="slider slider-min"
                  />
                  <input
                    type="range"
                    :min="minLimit"
                    :max="maxLimit"
                    step="5"
                    v-model.number="maxValue"
                    @input="validateMax"
                    class="slider slider-max"
                  />
                </div>
              <div class="row">
                <div class="col-5">
                  <div class="d-flex gap-2">
                    <p>Min:</p>
                    <input type="number" :min="minLimit" :max="maxLimit" step="5" v-model.number="minValue" class="form-control" @input="validateMin">
                  </div>
                </div>
                <div class="col-5 mb-3">
                  <div class="d-flex gap-2">
                    <p>Max:</p>
                    <input type="number" :min="minLimit" :max="maxLimit" step="5" v-model.number="maxValue" class="form-control" @input="validateMax">
                  </div>
                </div>
              </div>
            </div>

            <!-- additional filters  -->
            <button class="btn btn-link" 
              type="button" 
              data-bs-toggle="collapse" 
              data-bs-target="#collapseExample" 
              aria-expanded="false" 
              aria-controls="collapseExample"
            >
            Additional filters
            </button>

            <div class="collapse" id="collapseExample">
              <label class="form-label fw-semibold">Pet services:</label>
              <ul>
                <div class="form-check">
                  <input type="checkbox" v-model="selectedPets" class="form-check-input" value="dog">
                  <p>Dogs</p>
                  <input type="checkbox" v-model="selectedPets" class="form-check-input" value="cat">
                  <p>Cats</p>
                  <input type="checkbox" v-model="selectedPets" class="form-check-input" value="bird">
                  <p>Bird</p>
                  <input type="checkbox" v-model="selectedPets" class="form-check-input" value="rabbit">
                  <p>Rabbits</p>
                  <input type="checkbox" v-model="selectedPets" class="form-check-input" value="hamster">
                  <p>Hamster</p>
                </div>
              
                <div class="d-flex gap-2">
                  <label for="others" class="font-label">Others:</label>
                  <div class="col-5"><input type="text" v-model="otherPets" id="others"class="form-control"></div>
                </div>
              </ul>
              <label class="fw-semibold">Rating:</label>
              <StarRating v-model="userRating" :maxStars="5"></StarRating>
            </div>
            <button class="btn border border-warning rounded col-12 fw-semibold bg-light mt-3" @click="clearFilters">Clear filters</button>
          </div>
        </div>
        
        <!-- search body  -->
        <div class="col-lg-8 order-first">
          <!-- search bar  -->
          <div class="col-12 mb-3">
            <input type="text" v-model="searchKey" placeholder="Search by sitter name" class="form-control">
          </div>

          
          <div class="row">
            <div class="col-md-6  mb-2" v-for="sitter in searchResults">
              <!-- place holder value for price  -->
              <SitterProfileCard :sitter="sitter">
                <router-link :to="`/users/${sitter._id}`" class="btn border border-warning rounded col-12 fw-semibold bg-light">View Profile</router-link>
              </SitterProfileCard>
            </div>
          </div>
        </div>
      </div>


    </div>
  
</template>

<style scoped>
.range-slider-container {
  position: relative;
  width: 100%;
  height: 40px;
  display: flex;
  align-items: center; /* Vertically centers the tracks and thumbs */
}

/* The actual bar background */
.slider-track {
  position: absolute;
  width: 100%;
  height: 6px;
  border-radius: 3px;
  pointer-events: none; /* Allows clicks to pass through to the inputs */
}

.slider {
  position: absolute;
  width: 100%;
  pointer-events: none;
  appearance: none;
  background: none;
  margin: 0;
}

/* Webkit browser styling (Chrome, Safari, Edge, Opera) */
.slider::-webkit-slider-thumb {
  pointer-events: auto;
  cursor: pointer;
  appearance: none;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #42b983;
  border: 2px solid #fff;
  box-shadow: 0 1px 3px rgba(0,0,0,0.3);
}

/* Firefox browser styling */
.slider::-moz-range-thumb {
  pointer-events: auto;
  cursor: pointer;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #42b983;
  border: 2px solid #fff;
  box-shadow: 0 1px 3px rgba(0,0,0,0.3);
}

.values {
  position: absolute;
  width: 100%;
  display: flex;
  justify-content: space-between;
  top: 30px;
}

.availability-picker {
  width: 300px;
  font-family: Roboto, system-ui, -apple-system, sans-serif;
}

.availability-calendar {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  row-gap: 4px;
  text-align: center;
}

/* MO TU WE ... headers */
.weekday {
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: #3c3c3c;
  padding-bottom: 8px;
}

.day-cell {
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Light orange range band; start/end rules must stay below range-cell. */
.day-cell.range-cell  { background: #fff0e3; }
.day-cell.range-start { background: linear-gradient(to right, transparent 50%, #fff0e3 50%); }
.day-cell.range-end   { background: linear-gradient(to right, #fff0e3 50%, transparent 50%); }

.calendar-day {
  width: 34px;
  height: 34px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  font-size: 15px;
  color: #333;
  cursor: pointer;
}
.calendar-day:hover:not(:disabled) { background: #fce2cf; }

/* past dates: grey + strikethrough */
.calendar-day:disabled {
  color: #c8c8c8;
  text-decoration: line-through;
  cursor: default;
}

/* Selected endpoints: solid light orange circles. */
.calendar-day.endpoint,
.calendar-day.endpoint:hover {
  background: #fda501;
  color: #3d2417;
  font-weight: 700;
}
</style>
